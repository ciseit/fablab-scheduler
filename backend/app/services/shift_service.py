from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.location import Location
from app.models.schedule import Schedule
from app.models.shift import Shift
from app.schemas.shift import ShiftCreate


def create_shift(
    db: Session,
    shift_data: ShiftCreate,
) -> Shift:
    schedule = (
        db.query(Schedule)
        .filter(Schedule.id == shift_data.schedule_id)
        .first()
    )

    if schedule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found",
        )

    if shift_data.location_id is not None:
        location = (
            db.query(Location)
            .filter(Location.id == shift_data.location_id)
            .first()
        )

        if location is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Location not found",
            )

    shift = Shift(
        schedule_id=shift_data.schedule_id,
        location_id=shift_data.location_id,
        day_of_week=shift_data.day_of_week.value,
        start_time=shift_data.start_time,
        end_time=shift_data.end_time,
        required_technicians=shift_data.required_technicians,
    )

    db.add(shift)
    db.commit()
    db.refresh(shift)

    return shift


def get_shifts_for_schedule(
    db: Session,
    schedule_id: int,
) -> list[Shift]:
    return (
        db.query(Shift)
        .filter(Shift.schedule_id == schedule_id)
        .order_by(Shift.id)
        .all()
    )


def get_shift_by_id(
    db: Session,
    shift_id: int,
) -> Shift:
    shift = (
        db.query(Shift)
        .filter(Shift.id == shift_id)
        .first()
    )

    if shift is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shift not found",
        )

    return shift
