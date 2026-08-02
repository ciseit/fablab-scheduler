from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.availability import Availability
from app.models.collection_campaign import CollectionCampaign
from app.models.technician import Technician
from app.schemas.availability import (
    AvailabilityCreate,
    AvailabilityUpdate,
    PublicAvailabilitySubmission,
)


def create_availability(
    db: Session,
    technician_id: int,
    availability: AvailabilityCreate,
):
    technician = (
        db.query(Technician)
        .filter(Technician.id == technician_id)
        .first()
    )

    if technician is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Technician not found",
        )

    campaign = (
        db.query(CollectionCampaign)
        .filter(
            CollectionCampaign.id == availability.campaign_id
        )
        .first()
    )

    if campaign is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability Request not found",
        )

    duplicate = (
        db.query(Availability)
        .filter(
            Availability.technician_id == technician_id,
            Availability.campaign_id
            == availability.campaign_id,
            Availability.day_of_week
            == availability.day_of_week.value,
            Availability.start_time
            == availability.start_time,
            Availability.end_time
            == availability.end_time,
            Availability.availability_type
            == availability.availability_type.value,
        )
        .first()
    )

    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This availability block has already been "
                "submitted"
            ),
        )

    new_availability = Availability(
        technician_id=technician_id,
        campaign_id=availability.campaign_id,
        day_of_week=availability.day_of_week.value,
        start_time=availability.start_time,
        end_time=availability.end_time,
        availability_type=(
            availability.availability_type.value
        ),
    )

    db.add(new_availability)
    db.commit()
    db.refresh(new_availability)

    return new_availability


def create_public_availability_submission(
    db: Session,
    public_token: str,
    submission: PublicAvailabilitySubmission,
):
    campaign = (
        db.query(CollectionCampaign)
        .filter(
            CollectionCampaign.public_token == public_token
        )
        .first()
    )

    if campaign is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability Request not found",
        )

    normalized_email = str(submission.email).strip().lower()

    technician = (
        db.query(Technician)
        .filter(
            func.lower(Technician.email) == normalized_email
        )
        .first()
    )

    if technician is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Technician not found for this email",
        )

    submitted_blocks = set()
    new_availabilities = []

    for block in submission.availability_blocks:
        block_key = (
            block.day_of_week.value,
            block.start_time,
            block.end_time,
            block.availability_type.value,
        )

        if block_key in submitted_blocks:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "The submission contains duplicate "
                    "availability blocks"
                ),
            )

        submitted_blocks.add(block_key)

        existing_availability = (
            db.query(Availability)
            .filter(
                Availability.technician_id
                == technician.id,
                Availability.campaign_id
                == campaign.id,
                Availability.day_of_week
                == block.day_of_week.value,
                Availability.start_time
                == block.start_time,
                Availability.end_time
                == block.end_time,
                Availability.availability_type
                == block.availability_type.value,
            )
            .first()
        )

        if existing_availability is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "One or more availability blocks have "
                    "already been submitted"
                ),
            )

        new_availability = Availability(
            technician_id=technician.id,
            campaign_id=campaign.id,
            day_of_week=block.day_of_week.value,
            start_time=block.start_time,
            end_time=block.end_time,
            availability_type=(
                block.availability_type.value
            ),
        )

        new_availabilities.append(new_availability)

    try:
        db.add_all(new_availabilities)
        db.commit()

        for availability in new_availabilities:
            db.refresh(availability)

        return new_availabilities

    except Exception:
        db.rollback()
        raise


def get_availabilities_for_technician(
    db: Session,
    technician_id: int,
):
    technician = (
        db.query(Technician)
        .filter(Technician.id == technician_id)
        .first()
    )

    if technician is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Technician not found",
        )

    return (
        db.query(Availability)
        .filter(
            Availability.technician_id == technician_id
        )
        .all()
    )


def update_availability(
    db: Session,
    availability_id: int,
    availability_update: AvailabilityUpdate,
):
    availability = (
        db.query(Availability)
        .filter(Availability.id == availability_id)
        .first()
    )

    if availability is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability not found",
        )

    update_data = availability_update.model_dump(
        exclude_unset=True
    )

    if "campaign_id" in update_data:
        campaign = (
            db.query(CollectionCampaign)
            .filter(
                CollectionCampaign.id
                == update_data["campaign_id"]
            )
            .first()
        )

        if campaign is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Availability Request not found",
            )

    if "day_of_week" in update_data:
        update_data["day_of_week"] = (
            update_data["day_of_week"].value
        )

    if "availability_type" in update_data:
        update_data["availability_type"] = (
            update_data["availability_type"].value
        )

    for field, value in update_data.items():
        setattr(availability, field, value)

    if availability.end_time <= availability.start_time:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_time must be later than start_time",
        )

    duplicate = (
        db.query(Availability)
        .filter(
            Availability.id != availability.id,
            Availability.technician_id
            == availability.technician_id,
            Availability.campaign_id
            == availability.campaign_id,
            Availability.day_of_week
            == availability.day_of_week,
            Availability.start_time
            == availability.start_time,
            Availability.end_time
            == availability.end_time,
            Availability.availability_type
            == availability.availability_type,
        )
        .first()
    )

    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This availability block has already been "
                "submitted"
            ),
        )

    db.commit()
    db.refresh(availability)

    return availability


def delete_availability(
    db: Session,
    availability_id: int,
):
    availability = (
        db.query(Availability)
        .filter(Availability.id == availability_id)
        .first()
    )

    if availability is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability not found",
        )

    db.delete(availability)
    db.commit()

    return availability