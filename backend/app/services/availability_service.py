from sqlalchemy.orm import Session

from app.models.availability import Availability
from app.models.technician import Technician
from app.schemas.availability import AvailabilityCreate, AvailabilityUpdate


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
        return None

    new_availability = Availability(
        technician_id=technician_id,
        campaign_id=availability.campaign_id,
        day_of_week=availability.day_of_week.value,
        start_time=availability.start_time,
        end_time=availability.end_time,
        availability_type=availability.availability_type.value,
    )

    db.add(new_availability)
    db.commit()
    db.refresh(new_availability)

    return new_availability


def get_availability(
    db: Session,
    technician_id: int,
):
    return (
        db.query(Availability)
        .filter(Availability.technician_id == technician_id)
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
        return None

    update_data = availability_update.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        if hasattr(value, "value"):
            value = value.value
        setattr(availability, key, value)

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
        return None

    db.delete(availability)
    db.commit()

    return availability