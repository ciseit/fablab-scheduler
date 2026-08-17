from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.location import Location
from app.schemas.location import LocationCreate, LocationUpdate


def _lower_eq(column, value):
    return func.lower(column) == value.strip().lower()


def create_location(db: Session, data: LocationCreate) -> Location:
    existing = (
        db.query(Location)
        .filter(_lower_eq(Location.name, data.name))
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A location with this name already exists.",
        )

    location = Location(name=data.name, is_active=True)

    db.add(location)
    db.commit()
    db.refresh(location)

    return location


def get_locations(db: Session, include_inactive: bool = True) -> list[Location]:
    query = db.query(Location)

    if not include_inactive:
        query = query.filter(Location.is_active.is_(True))

    return query.order_by(Location.name).all()


def get_location_or_404(db: Session, location_id: int) -> Location:
    location = (
        db.query(Location).filter(Location.id == location_id).first()
    )

    if location is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found",
        )

    return location


def update_location(
    db: Session,
    location_id: int,
    data: LocationUpdate,
) -> Location:
    location = get_location_or_404(db, location_id)

    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data:
        existing = (
            db.query(Location)
            .filter(
                _lower_eq(Location.name, update_data["name"]),
                Location.id != location_id,
            )
            .first()
        )

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A location with this name already exists.",
            )

    for field, value in update_data.items():
        setattr(location, field, value)

    db.commit()
    db.refresh(location)

    return location
