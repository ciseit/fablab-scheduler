import secrets
from collections import defaultdict
from datetime import datetime, time, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.availability import Availability
from app.models.collection_campaign import CollectionCampaign
from app.models.shift import Shift
from app.models.technician import Technician
from app.schemas.assignment import AssignmentUpdate


MIN_WEEKLY_HOURS = 15.0
TARGET_WEEKLY_HOURS = 20.0

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


def _get_campaign_or_404(
    db: Session,
    campaign_id: int,
) -> CollectionCampaign:
    campaign = (
        db.query(CollectionCampaign)
        .filter(CollectionCampaign.id == campaign_id)
        .first()
    )

    if campaign is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability Request not found",
        )

    return campaign


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
) -> dict:
    technicians_below_minimum = []

    for technician in technicians:
        hours = hours_assigned.get(technician.id, 0.0)

        if hours < MIN_WEEKLY_HOURS:
            technicians_below_minimum.append(
                {
                    "technician_id": technician.id,
                    "technician_name": technician.name,
                    "assigned_hours": round(hours, 2),
                    "shortfall_hours": round(
                        MIN_WEEKLY_HOURS - hours, 2
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
    campaign_id: int,
) -> dict:
    campaign = _get_campaign_or_404(db, campaign_id)

    shifts = (
        db.query(Shift)
        .filter(Shift.campaign_id == campaign_id)
        .all()
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

    availabilities = (
        db.query(Availability)
        .filter(
            Availability.campaign_id == campaign_id,
            Availability.availability_type != "restricted",
        )
        .all()
    )

    availability_by_technician: dict[int, list[Availability]] = defaultdict(list)

    for availability in availabilities:
        availability_by_technician[availability.technician_id].append(
            availability
        )

    # Regenerating a schedule replaces any previously generated draft.
    db.query(Assignment).filter(
        Assignment.campaign_id == campaign_id
    ).delete(synchronize_session=False)
    db.commit()

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
                campaign_id=campaign_id,
                shift_id=shift.id,
                technician_id=candidate.id,
                status="scheduled",
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

    summary = _build_summary(technicians, hours_assigned, uncovered)

    return {
        "campaign_id": campaign_id,
        "assignments": new_assignments,
        "published": campaign.schedule_published_at is not None,
        "public_token": campaign.schedule_public_token,
        **summary,
    }


def get_schedule(
    db: Session,
    campaign_id: int,
) -> dict:
    campaign = _get_campaign_or_404(db, campaign_id)

    assignments = (
        db.query(Assignment)
        .filter(Assignment.campaign_id == campaign_id)
        .order_by(Assignment.id)
        .all()
    )

    shifts = (
        db.query(Shift)
        .filter(Shift.campaign_id == campaign_id)
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

    summary = _build_summary(technicians, hours_assigned, uncovered)

    return {
        "campaign_id": campaign_id,
        "assignments": assignments,
        "published": campaign.schedule_published_at is not None,
        "public_token": campaign.schedule_public_token,
        **summary,
    }


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

    if new_technician.status != "active":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Technician is not active",
        )

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

    covering_block = (
        db.query(Availability)
        .filter(
            Availability.technician_id == new_technician.id,
            Availability.campaign_id == assignment.campaign_id,
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

    other_assignments = (
        db.query(Assignment)
        .filter(
            Assignment.campaign_id == assignment.campaign_id,
            Assignment.technician_id == new_technician.id,
            Assignment.id != assignment.id,
        )
        .all()
    )

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

    assignment.technician_id = new_technician.id

    db.commit()
    db.refresh(assignment)

    return assignment


def _generate_unique_schedule_token(db: Session) -> str:
    while True:
        token = secrets.token_urlsafe(12)

        existing = (
            db.query(CollectionCampaign)
            .filter(CollectionCampaign.schedule_public_token == token)
            .first()
        )

        if existing is None:
            return token


def publish_schedule(
    db: Session,
    campaign_id: int,
) -> dict:
    campaign = _get_campaign_or_404(db, campaign_id)

    has_assignments = (
        db.query(Assignment)
        .filter(Assignment.campaign_id == campaign_id)
        .first()
        is not None
    )

    if not has_assignments:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Generate a schedule with at least one assignment "
                "before publishing"
            ),
        )

    if campaign.schedule_public_token is None:
        campaign.schedule_public_token = (
            _generate_unique_schedule_token(db)
        )

    campaign.schedule_published_at = datetime.now(timezone.utc)

    db.commit()

    return get_schedule(db, campaign_id)


def get_public_schedule(
    db: Session,
    public_token: str,
) -> dict:
    campaign = (
        db.query(CollectionCampaign)
        .filter(
            CollectionCampaign.schedule_public_token == public_token
        )
        .first()
    )

    if campaign is None or campaign.schedule_published_at is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Published schedule not found",
        )

    assignments = (
        db.query(Assignment)
        .filter(Assignment.campaign_id == campaign.id)
        .all()
    )

    shifts_by_id = {
        shift.id: shift
        for shift in db.query(Shift)
        .filter(Shift.campaign_id == campaign.id)
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

    public_assignments = []
    hours_by_technician: dict[int, float] = defaultdict(float)

    for assignment in assignments:
        shift = shifts_by_id.get(assignment.shift_id)
        technician = technicians_by_id.get(assignment.technician_id)

        if shift is None or technician is None:
            continue

        public_assignments.append(
            {
                "shift_id": shift.id,
                "day_of_week": shift.day_of_week,
                "start_time": shift.start_time,
                "end_time": shift.end_time,
                "technician_name": technician.name,
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
        "campaign_name": campaign.name,
        "semester": campaign.semester,
        "published_at": campaign.schedule_published_at,
        "assignments": public_assignments,
        "technician_hours": technician_hours,
    }
