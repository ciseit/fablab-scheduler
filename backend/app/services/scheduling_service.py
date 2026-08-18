import secrets
from collections import defaultdict
from datetime import datetime, time, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.availability import Availability
from app.models.location import Location
from app.models.schedule import Schedule
from app.models.schedule_category import ScheduleCategory
from app.models.shift import Shift
from app.models.technician import Technician
from app.schemas.assignment import AssignmentCreate, AssignmentUpdate
from app.services.schedule_service import require_draft_schedule


DAY_ORDER = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}

# Lower rank is preferred first. "restricted" is never eligible and is
# excluded before this ranking is consulted.
PREFERENCE_RANK = {
    "preferred": 0,
    "available": 1,
    "backup": 2,
}

DEFAULT_WORKING_CATEGORY_NAME = "Working"


def _duration_hours(start: time, end: time) -> float:
    start_minutes = start.hour * 60 + start.minute
    end_minutes = end.hour * 60 + end.minute

    return (end_minutes - start_minutes) / 60.0


def _blocks_overlap(
    day_a: str,
    start_a: time,
    end_a: time,
    day_b: str,
    start_b: time,
    end_b: time,
) -> bool:
    if day_a != day_b:
        return False

    return start_a < end_b and start_b < end_a


def _has_overlap(
    existing_blocks: list[tuple[str, time, time]],
    day: str,
    start: time,
    end: time,
) -> bool:
    for existing_day, existing_start, existing_end in existing_blocks:
        if _blocks_overlap(
            day, start, end, existing_day, existing_start, existing_end
        ):
            return True

    return False


def _get_schedule_or_404(db: Session, schedule_id: int) -> Schedule:
    schedule = (
        db.query(Schedule).filter(Schedule.id == schedule_id).first()
    )

    if schedule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found",
        )

    return schedule


def _get_default_working_category(db: Session) -> ScheduleCategory | None:
    return (
        db.query(ScheduleCategory)
        .filter(ScheduleCategory.name == DEFAULT_WORKING_CATEGORY_NAME)
        .first()
    )


def _pick_best_technician(
    shift: Shift,
    technicians: list[Technician],
    availability_by_technician: dict[int, list[Availability]],
    technician_schedule: dict[int, list[tuple[str, time, time]]],
    hours_assigned: dict[int, float],
) -> Technician | None:
    candidates = []

    for technician in technicians:
        blocks = availability_by_technician.get(technician.id, [])

        best_rank = None

        for block in blocks:
            if block.day_of_week != shift.day_of_week:
                continue

            if (
                block.start_time > shift.start_time
                or block.end_time < shift.end_time
            ):
                # The submitted block does not fully cover this shift.
                continue

            rank = PREFERENCE_RANK[block.availability_type]

            if best_rank is None or rank < best_rank:
                best_rank = rank

        if best_rank is None:
            # No submitted (non-restricted) availability covers this shift.
            continue

        if _has_overlap(
            technician_schedule[technician.id],
            shift.day_of_week,
            shift.start_time,
            shift.end_time,
        ):
            continue

        candidates.append(
            (best_rank, hours_assigned[technician.id], technician.id, technician)
        )

    if not candidates:
        return None

    # Prefer preferred/available candidates over backup ones; only fall
    # back to backup availability when nothing better is eligible.
    non_backup_candidates = [
        candidate for candidate in candidates if candidate[0] < PREFERENCE_RANK["backup"]
    ]

    pool = non_backup_candidates if non_backup_candidates else candidates

    pool.sort(key=lambda candidate: (candidate[0], candidate[1], candidate[2]))

    return pool[0][3]


def _build_summary(
    technicians: list[Technician],
    hours_assigned: dict[int, float],
    uncovered: list[dict],
    minimum_weekly_hours: float,
) -> dict:
    technicians_below_minimum = []

    for technician in technicians:
        hours = hours_assigned.get(technician.id, 0.0)

        if hours < minimum_weekly_hours:
            technicians_below_minimum.append(
                {
                    "technician_id": technician.id,
                    "technician_name": technician.name,
                    "assigned_hours": round(hours, 2),
                    "shortfall_hours": round(
                        minimum_weekly_hours - hours, 2
                    ),
                }
            )

    uncovered_shifts = []

    for item in uncovered:
        shift = item["shift"]

        uncovered_shifts.append(
            {
                "shift_id": shift.id,
                "day_of_week": shift.day_of_week,
                "start_time": shift.start_time,
                "end_time": shift.end_time,
                "required_technicians": shift.required_technicians,
                "assigned_technicians": item["assigned_technicians"],
                "shortfall": (
                    shift.required_technicians
                    - item["assigned_technicians"]
                ),
            }
        )

    return {
        "technicians_below_minimum": technicians_below_minimum,
        "uncovered_shifts": uncovered_shifts,
    }


def generate_schedule(
    db: Session,
    schedule_id: int,
) -> dict:
    schedule = _get_schedule_or_404(db, schedule_id)
    require_draft_schedule(schedule)

    shifts = (
        db.query(Shift)
        .filter(Shift.schedule_id == schedule_id)
        .all()
    )

    if not shifts:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Add at least one shift to this schedule before "
                "generating it."
            ),
        )

    shifts.sort(
        key=lambda shift: (
            DAY_ORDER.get(shift.day_of_week, 7),
            shift.start_time,
            shift.id,
        )
    )

    technicians = (
        db.query(Technician)
        .filter(Technician.status == "active")
        .order_by(Technician.id)
        .all()
    )

    availability_by_technician: dict[int, list[Availability]] = defaultdict(list)

    if schedule.campaign_id is not None:
        availabilities = (
            db.query(Availability)
            .filter(
                Availability.campaign_id == schedule.campaign_id,
                Availability.availability_type != "restricted",
            )
            .all()
        )

        for availability in availabilities:
            availability_by_technician[availability.technician_id].append(
                availability
            )

    # Regenerating a schedule replaces any previously generated draft.
    db.query(Assignment).filter(
        Assignment.schedule_id == schedule_id
    ).delete(synchronize_session=False)
    db.commit()

    working_category = _get_default_working_category(db)

    hours_assigned = {technician.id: 0.0 for technician in technicians}
    technician_schedule: dict[int, list[tuple[str, time, time]]] = defaultdict(list)

    new_assignments: list[Assignment] = []
    uncovered: list[dict] = []

    for shift in shifts:
        shift_hours = _duration_hours(shift.start_time, shift.end_time)
        filled = 0

        for _ in range(shift.required_technicians):
            candidate = _pick_best_technician(
                shift,
                technicians,
                availability_by_technician,
                technician_schedule,
                hours_assigned,
            )

            if candidate is None:
                break

            assignment = Assignment(
                schedule_id=schedule_id,
                shift_id=shift.id,
                technician_id=candidate.id,
                status="scheduled",
                category_id=(
                    working_category.id if working_category else None
                ),
            )

            db.add(assignment)
            new_assignments.append(assignment)

            technician_schedule[candidate.id].append(
                (shift.day_of_week, shift.start_time, shift.end_time)
            )
            hours_assigned[candidate.id] += shift_hours
            filled += 1

        if filled < shift.required_technicians:
            uncovered.append(
                {
                    "shift": shift,
                    "assigned_technicians": filled,
                }
            )

    db.commit()

    for assignment in new_assignments:
        db.refresh(assignment)

    summary = _build_summary(
        technicians,
        hours_assigned,
        uncovered,
        schedule.minimum_weekly_hours,
    )

    return {
        "schedule_id": schedule_id,
        "assignments": new_assignments,
        "published": schedule.published_at is not None,
        "public_token": schedule.public_token,
        "minimum_weekly_hours": schedule.minimum_weekly_hours,
        **summary,
    }


def get_schedule_board(
    db: Session,
    schedule_id: int,
) -> dict:
    schedule = _get_schedule_or_404(db, schedule_id)

    assignments = (
        db.query(Assignment)
        .filter(Assignment.schedule_id == schedule_id)
        .order_by(Assignment.id)
        .all()
    )

    shifts = (
        db.query(Shift)
        .filter(Shift.schedule_id == schedule_id)
        .all()
    )

    technicians = (
        db.query(Technician)
        .filter(Technician.status == "active")
        .order_by(Technician.id)
        .all()
    )

    shifts_by_id = {shift.id: shift for shift in shifts}
    hours_assigned = {technician.id: 0.0 for technician in technicians}
    assigned_count_by_shift: dict[int, int] = defaultdict(int)

    for assignment in assignments:
        shift = shifts_by_id.get(assignment.shift_id)

        if shift is None:
            continue

        assigned_count_by_shift[assignment.shift_id] += 1

        if assignment.technician_id in hours_assigned:
            hours_assigned[assignment.technician_id] += _duration_hours(
                shift.start_time, shift.end_time
            )

    uncovered = []

    for shift in shifts:
        assigned_count = assigned_count_by_shift.get(shift.id, 0)

        if assigned_count < shift.required_technicians:
            uncovered.append(
                {
                    "shift": shift,
                    "assigned_technicians": assigned_count,
                }
            )

    summary = _build_summary(
        technicians,
        hours_assigned,
        uncovered,
        schedule.minimum_weekly_hours,
    )

    return {
        "schedule_id": schedule_id,
        "assignments": assignments,
        "published": schedule.published_at is not None,
        "public_token": schedule.public_token,
        "minimum_weekly_hours": schedule.minimum_weekly_hours,
        **summary,
    }


def _validate_technician_for_shift(
    db: Session,
    schedule: Schedule,
    shift: Shift,
    technician: Technician,
    excluding_assignment_id: int | None,
) -> None:
    if technician.status != "active":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Technician is not active",
        )

    # Availability coverage is only meaningful (and only checkable) when
    # this schedule is linked to an Availability Request. A fully manual
    # schedule has no availability data to validate against.
    if schedule.campaign_id is not None:
        covering_block = (
            db.query(Availability)
            .filter(
                Availability.technician_id == technician.id,
                Availability.campaign_id == schedule.campaign_id,
                Availability.day_of_week == shift.day_of_week,
                Availability.availability_type != "restricted",
                Availability.start_time <= shift.start_time,
                Availability.end_time >= shift.end_time,
            )
            .first()
        )

        if covering_block is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "This technician has no submitted availability "
                    "covering this shift"
                ),
            )

    other_assignments_query = db.query(Assignment).filter(
        Assignment.schedule_id == schedule.id,
        Assignment.technician_id == technician.id,
    )

    if excluding_assignment_id is not None:
        other_assignments_query = other_assignments_query.filter(
            Assignment.id != excluding_assignment_id
        )

    other_assignments = other_assignments_query.all()

    if other_assignments:
        other_shift_ids = [
            other.shift_id for other in other_assignments
        ]

        other_shifts = (
            db.query(Shift)
            .filter(Shift.id.in_(other_shift_ids))
            .all()
        )

        for other_shift in other_shifts:
            if _blocks_overlap(
                shift.day_of_week,
                shift.start_time,
                shift.end_time,
                other_shift.day_of_week,
                other_shift.start_time,
                other_shift.end_time,
            ):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "This technician already has an overlapping "
                        "assignment"
                    ),
                )


def _get_active_category_or_404(
    db: Session, category_id: int
) -> ScheduleCategory:
    category = (
        db.query(ScheduleCategory)
        .filter(ScheduleCategory.id == category_id)
        .first()
    )

    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    if not category.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f'The "{category.name}" category has been archived and '
                "can't be assigned to new shifts."
            ),
        )

    return category


def create_assignment(
    db: Session,
    schedule_id: int,
    data: AssignmentCreate,
) -> Assignment:
    schedule = _get_schedule_or_404(db, schedule_id)
    require_draft_schedule(schedule)

    shift = (
        db.query(Shift)
        .filter(
            Shift.id == data.shift_id,
            Shift.schedule_id == schedule_id,
        )
        .first()
    )

    if shift is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shift not found on this schedule",
        )

    technician = (
        db.query(Technician)
        .filter(Technician.id == data.technician_id)
        .first()
    )

    if technician is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Technician not found",
        )

    already_assigned = (
        db.query(Assignment)
        .filter(
            Assignment.shift_id == shift.id,
            Assignment.technician_id == technician.id,
        )
        .first()
    )

    if already_assigned is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This technician is already assigned to this shift.",
        )

    _validate_technician_for_shift(
        db, schedule, shift, technician, excluding_assignment_id=None
    )

    category_id = data.category_id

    if category_id is not None:
        _get_active_category_or_404(db, category_id)
    else:
        working_category = _get_default_working_category(db)
        category_id = working_category.id if working_category else None

    assignment = Assignment(
        schedule_id=schedule_id,
        shift_id=shift.id,
        technician_id=technician.id,
        status="scheduled",
        category_id=category_id,
    )

    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    return assignment


def edit_assignment(
    db: Session,
    assignment_id: int,
    update: AssignmentUpdate,
) -> Assignment:
    assignment = (
        db.query(Assignment)
        .filter(Assignment.id == assignment_id)
        .first()
    )

    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )

    schedule = _get_schedule_or_404(db, assignment.schedule_id)
    require_draft_schedule(schedule)

    shift = (
        db.query(Shift)
        .filter(Shift.id == assignment.shift_id)
        .first()
    )

    if shift is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shift not found",
        )

    if update.technician_id is not None:
        new_technician = (
            db.query(Technician)
            .filter(Technician.id == update.technician_id)
            .first()
        )

        if new_technician is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Technician not found",
            )

        _validate_technician_for_shift(
            db,
            schedule,
            shift,
            new_technician,
            excluding_assignment_id=assignment.id,
        )

        assignment.technician_id = new_technician.id

    if update.clear_category:
        assignment.category_id = None
    elif update.category_id is not None:
        _get_active_category_or_404(db, update.category_id)
        assignment.category_id = update.category_id

    db.commit()
    db.refresh(assignment)

    return assignment


def delete_assignment(db: Session, assignment_id: int) -> None:
    assignment = (
        db.query(Assignment)
        .filter(Assignment.id == assignment_id)
        .first()
    )

    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )

    schedule = _get_schedule_or_404(db, assignment.schedule_id)
    require_draft_schedule(schedule)

    db.delete(assignment)
    db.commit()


def _generate_unique_schedule_token(db: Session) -> str:
    while True:
        token = secrets.token_urlsafe(12)

        existing = (
            db.query(Schedule)
            .filter(Schedule.public_token == token)
            .first()
        )

        if existing is None:
            return token


def publish_schedule(
    db: Session,
    schedule_id: int,
) -> dict:
    schedule = _get_schedule_or_404(db, schedule_id)

    has_assignments = (
        db.query(Assignment)
        .filter(Assignment.schedule_id == schedule_id)
        .first()
        is not None
    )

    if not has_assignments:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Add at least one assignment before publishing this "
                "schedule."
            ),
        )

    # Republishing a working copy created via "Edit Published Schedule":
    # hand this copy the original's public identity (same link keeps
    # working) and retire the original as superseded history, instead of
    # minting a fresh, unrelated public link.
    if schedule.editing_source_id is not None:
        original = (
            db.query(Schedule)
            .filter(Schedule.id == schedule.editing_source_id)
            .first()
        )

        if original is not None and original.status == "published":
            token = original.public_token

            original.public_token = None
            original.status = "superseded"
            # Flush the token-clearing update first so the unique
            # constraint on public_token is never briefly violated by
            # two rows holding the same value.
            db.flush()

            schedule.public_token = token
            schedule.published_at = datetime.now(timezone.utc)
            schedule.status = "published"

            db.commit()

            return get_schedule_board(db, schedule_id)

    if schedule.public_token is None:
        schedule.public_token = _generate_unique_schedule_token(db)

    schedule.published_at = datetime.now(timezone.utc)
    schedule.status = "published"

    db.commit()

    return get_schedule_board(db, schedule_id)


def start_editing_published_schedule(
    db: Session,
    schedule_id: int,
) -> Schedule:
    original = _get_schedule_or_404(db, schedule_id)

    if original.status != "published":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Only a currently published schedule can be edited this "
                "way."
            ),
        )

    existing_draft = (
        db.query(Schedule)
        .filter(
            Schedule.editing_source_id == original.id,
            Schedule.status == "draft",
        )
        .first()
    )

    if existing_draft is not None:
        return existing_draft

    clone = Schedule(
        name=f"{original.name} (Editing)",
        start_date=original.start_date,
        end_date=original.end_date,
        semester=original.semester,
        notes=original.notes,
        minimum_weekly_hours=original.minimum_weekly_hours,
        campaign_id=original.campaign_id,
        status="draft",
        editing_source_id=original.id,
    )

    db.add(clone)
    db.flush()

    shift_id_map: dict[int, int] = {}

    original_shifts = (
        db.query(Shift).filter(Shift.schedule_id == original.id).all()
    )

    for shift in original_shifts:
        new_shift = Shift(
            schedule_id=clone.id,
            location_id=shift.location_id,
            day_of_week=shift.day_of_week,
            start_time=shift.start_time,
            end_time=shift.end_time,
            required_technicians=shift.required_technicians,
        )
        db.add(new_shift)
        db.flush()
        shift_id_map[shift.id] = new_shift.id

    original_assignments = (
        db.query(Assignment)
        .filter(Assignment.schedule_id == original.id)
        .all()
    )

    for assignment in original_assignments:
        new_shift_id = shift_id_map.get(assignment.shift_id)

        if new_shift_id is None:
            continue

        db.add(
            Assignment(
                schedule_id=clone.id,
                shift_id=new_shift_id,
                technician_id=assignment.technician_id,
                status=assignment.status,
                category_id=assignment.category_id,
            )
        )

    db.commit()
    db.refresh(clone)

    return clone


def get_public_schedule(
    db: Session,
    public_token: str,
) -> dict:
    schedule = (
        db.query(Schedule)
        .filter(Schedule.public_token == public_token)
        .first()
    )

    if schedule is None or schedule.published_at is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Published schedule not found",
        )

    assignments = (
        db.query(Assignment)
        .filter(Assignment.schedule_id == schedule.id)
        .all()
    )

    shifts_by_id = {
        shift.id: shift
        for shift in db.query(Shift)
        .filter(Shift.schedule_id == schedule.id)
        .all()
    }

    technician_ids = {
        assignment.technician_id for assignment in assignments
    }

    technicians_by_id = (
        {
            technician.id: technician
            for technician in db.query(Technician)
            .filter(Technician.id.in_(technician_ids))
            .all()
        }
        if technician_ids
        else {}
    )

    location_ids = {
        shift.location_id
        for shift in shifts_by_id.values()
        if shift.location_id is not None
    }

    locations_by_id = (
        {
            location.id: location
            for location in db.query(Location)
            .filter(Location.id.in_(location_ids))
            .all()
        }
        if location_ids
        else {}
    )

    category_ids = {
        assignment.category_id
        for assignment in assignments
        if assignment.category_id is not None
    }

    categories_by_id = (
        {
            category.id: category
            for category in db.query(ScheduleCategory)
            .filter(ScheduleCategory.id.in_(category_ids))
            .all()
        }
        if category_ids
        else {}
    )

    public_assignments = []
    hours_by_technician: dict[int, float] = defaultdict(float)

    for assignment in assignments:
        shift = shifts_by_id.get(assignment.shift_id)
        technician = technicians_by_id.get(assignment.technician_id)

        if shift is None or technician is None:
            continue

        location = (
            locations_by_id.get(shift.location_id)
            if shift.location_id
            else None
        )
        category = (
            categories_by_id.get(assignment.category_id)
            if assignment.category_id
            else None
        )

        public_assignments.append(
            {
                "shift_id": shift.id,
                "day_of_week": shift.day_of_week,
                "start_time": shift.start_time,
                "end_time": shift.end_time,
                "technician_name": technician.name,
                "location_name": location.name if location else None,
                "category_name": category.name if category else None,
                "category_color": category.color if category else None,
            }
        )

        hours_by_technician[technician.id] += _duration_hours(
            shift.start_time, shift.end_time
        )

    public_assignments.sort(
        key=lambda row: (
            DAY_ORDER.get(row["day_of_week"], 7),
            row["start_time"],
            row["shift_id"],
        )
    )

    technician_hours = sorted(
        (
            {
                "technician_name": technicians_by_id[technician_id].name,
                "assigned_hours": round(hours, 2),
            }
            for technician_id, hours in hours_by_technician.items()
        ),
        key=lambda row: row["technician_name"].lower(),
    )

    return {
        "schedule_name": schedule.name,
        "semester": schedule.semester,
        "published_at": schedule.published_at,
        "assignments": public_assignments,
        "technician_hours": technician_hours,
    }
