from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.collection_campaign import CollectionCampaign
from app.models.shift import Shift
from app.schemas.shift import ShiftCreate


def create_shift(
    db: Session,
    shift_data: ShiftCreate,
) -> Shift:
    campaign = (
        db.query(CollectionCampaign)
        .filter(
            CollectionCampaign.id == shift_data.campaign_id
        )
        .first()
    )

    if campaign is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability Request not found",
        )

    shift = Shift(
        campaign_id=shift_data.campaign_id,
        day_of_week=shift_data.day_of_week.value,
        start_time=shift_data.start_time,
        end_time=shift_data.end_time,
        required_technicians=shift_data.required_technicians,
    )

    db.add(shift)
    db.commit()
    db.refresh(shift)

    return shift


def get_shifts_for_campaign(
    db: Session,
    campaign_id: int,
) -> list[Shift]:
    return (
        db.query(Shift)
        .filter(Shift.campaign_id == campaign_id)
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
