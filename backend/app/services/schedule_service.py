from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.collection_campaign import CollectionCampaign
from app.models.schedule import Schedule
from app.models.shift import Shift
from app.schemas.schedule import ScheduleCreate, ScheduleUpdate


EDIT_PUBLISHED_SCHEDULE_MESSAGE = (
    'This schedule is published and is protected from direct changes. '
    'Use "Edit Published Schedule" to make changes safely -- the '
    "current public schedule stays exactly as-is until you republish."
)


def require_draft_schedule(schedule: Schedule) -> None:
    """
    Guards every direct create/edit/delete action that would mutate a
    schedule's own shifts/assignments/metadata. Only a schedule with
    status "draft" (a brand-new schedule, or a working copy created via
    "Edit Published Schedule") may be changed this way. "published" and
    "superseded" schedules must go through the edit-copy workflow
    instead, so the live public schedule is never mutated out from under
    anyone viewing it.
    """

    if schedule.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=EDIT_PUBLISHED_SCHEDULE_MESSAGE,
        )


def _get_campaign_or_404(db: Session, campaign_id: int) -> CollectionCampaign:
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


def create_schedule(
    db: Session,
    schedule_data: ScheduleCreate,
) -> Schedule:
    if schedule_data.campaign_id is not None:
        _get_campaign_or_404(db, schedule_data.campaign_id)

    schedule = Schedule(
        name=schedule_data.name,
        start_date=schedule_data.start_date,
        end_date=schedule_data.end_date,
        semester=schedule_data.semester,
        notes=schedule_data.notes,
        minimum_weekly_hours=schedule_data.minimum_weekly_hours,
        campaign_id=schedule_data.campaign_id,
        status="draft",
    )

    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    return schedule


def update_schedule(
    db: Session,
    schedule_id: int,
    schedule_data: ScheduleUpdate,
) -> Schedule:
    schedule = get_schedule_or_404(db, schedule_id)
    require_draft_schedule(schedule)

    update_data = schedule_data.model_dump(exclude_unset=True)

    if "campaign_id" in update_data and update_data["campaign_id"] is not None:
        _get_campaign_or_404(db, update_data["campaign_id"])

    for field, value in update_data.items():
        setattr(schedule, field, value)

    db.commit()
    db.refresh(schedule)

    return schedule


def get_schedule_or_404(db: Session, schedule_id: int) -> Schedule:
    schedule = (
        db.query(Schedule)
        .filter(Schedule.id == schedule_id)
        .first()
    )

    if schedule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found",
        )

    return schedule


def delete_schedule(db: Session, schedule_id: int) -> None:
    schedule = get_schedule_or_404(db, schedule_id)
    require_draft_schedule(schedule)

    shift_ids = [
        shift_id
        for (shift_id,) in db.query(Shift.id).filter(
            Shift.schedule_id == schedule_id
        )
    ]

    db.query(Assignment).filter(
        Assignment.schedule_id == schedule_id
    ).delete(synchronize_session=False)

    if shift_ids:
        db.query(Shift).filter(Shift.id.in_(shift_ids)).delete(
            synchronize_session=False
        )

    db.delete(schedule)
    db.commit()


def list_schedules(db: Session) -> list[dict]:
    schedules = (
        db.query(Schedule).order_by(Schedule.id.desc()).all()
    )

    campaign_names = dict(
        db.query(CollectionCampaign.id, CollectionCampaign.name).all()
    )

    shift_counts = dict(
        db.query(Shift.schedule_id, func.count(Shift.id))
        .group_by(Shift.schedule_id)
        .all()
    )

    assignment_counts = dict(
        db.query(Assignment.schedule_id, func.count(Assignment.id))
        .group_by(Assignment.schedule_id)
        .all()
    )

    results = []

    for schedule in schedules:
        results.append(
            {
                "id": schedule.id,
                "name": schedule.name,
                "start_date": schedule.start_date,
                "end_date": schedule.end_date,
                "semester": schedule.semester,
                "notes": schedule.notes,
                "minimum_weekly_hours": schedule.minimum_weekly_hours,
                "campaign_id": schedule.campaign_id,
                "status": schedule.status,
                "published_at": schedule.published_at,
                "public_token": schedule.public_token,
                "editing_source_id": schedule.editing_source_id,
                "campaign_name": (
                    campaign_names.get(schedule.campaign_id)
                    if schedule.campaign_id
                    else None
                ),
                "shift_count": shift_counts.get(schedule.id, 0),
                "assignment_count": assignment_counts.get(schedule.id, 0),
            }
        )

    return results
