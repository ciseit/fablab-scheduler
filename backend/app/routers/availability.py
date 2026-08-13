from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.auth_dependencies import get_current_admin
from app.database.connection import get_db
from app.schemas.availability import (
    AvailabilityCreate,
    AvailabilityResponse,
    AvailabilityUpdate,
    PublicAvailabilitySubmission,
)
from app.services.availability_service import (
    create_availability,
    create_public_availability_submission,
    delete_availability,
    get_availabilities_for_technician,
    update_availability,
)


router = APIRouter(
    prefix="/availability",
    tags=["Availability"],
)


@router.post(
    "/technicians/{technician_id}",
    response_model=AvailabilityResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(get_current_admin)],
)
def create_availability_endpoint(
    technician_id: int,
    availability: AvailabilityCreate,
    db: Session = Depends(get_db),
):
    return create_availability(
        db=db,
        technician_id=technician_id,
        availability=availability,
    )


@router.post(
    "/public/{public_token}",
    response_model=list[AvailabilityResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_public_availability_submission_endpoint(
    public_token: str,
    submission: PublicAvailabilitySubmission,
    db: Session = Depends(get_db),
):
    return create_public_availability_submission(
        db=db,
        public_token=public_token,
        submission=submission,
    )


@router.get(
    "/technicians/{technician_id}",
    response_model=list[AvailabilityResponse],
    dependencies=[Depends(get_current_admin)],
)
def get_availabilities_for_technician_endpoint(
    technician_id: int,
    db: Session = Depends(get_db),
):
    return get_availabilities_for_technician(
        db=db,
        technician_id=technician_id,
    )


@router.patch(
    "/{availability_id}",
    response_model=AvailabilityResponse,
    dependencies=[Depends(get_current_admin)],
)
def update_availability_endpoint(
    availability_id: int,
    availability_update: AvailabilityUpdate,
    db: Session = Depends(get_db),
):
    return update_availability(
        db=db,
        availability_id=availability_id,
        availability_update=availability_update,
    )


@router.delete(
    "/{availability_id}",
    response_model=AvailabilityResponse,
    dependencies=[Depends(get_current_admin)],
)
def delete_availability_endpoint(
    availability_id: int,
    db: Session = Depends(get_db),
):
    return delete_availability(
        db=db,
        availability_id=availability_id,
    )