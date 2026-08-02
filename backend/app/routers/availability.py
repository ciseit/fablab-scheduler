from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.schemas.availability import (
    AvailabilityCreate,
    AvailabilityResponse,
    AvailabilityUpdate,
)
from app.services import availability_service

router = APIRouter(
    prefix="/availability",
    tags=["Availability"],
)


@router.post(
    "/technicians/{technician_id}",
    response_model=AvailabilityResponse,
)
def create_availability(
    technician_id: int,
    availability: AvailabilityCreate,
    db: Session = Depends(get_db),
):
    result = availability_service.create_availability(
        db,
        technician_id,
        availability,
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Technician not found",
        )

    return result


@router.get(
    "/technicians/{technician_id}",
    response_model=list[AvailabilityResponse],
)
def get_availability(
    technician_id: int,
    db: Session = Depends(get_db),
):
    return availability_service.get_availability(
        db,
        technician_id,
    )


@router.patch(
    "/{availability_id}",
    response_model=AvailabilityResponse,
)
def update_availability(
    availability_id: int,
    availability: AvailabilityUpdate,
    db: Session = Depends(get_db),
):
    result = availability_service.update_availability(
        db,
        availability_id,
        availability,
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Availability not found",
        )

    return result


@router.delete(
    "/{availability_id}",
)
def delete_availability(
    availability_id: int,
    db: Session = Depends(get_db),
):
    result = availability_service.delete_availability(
        db,
        availability_id,
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Availability not found",
        )

    return {
        "message": "Availability deleted successfully"
    }