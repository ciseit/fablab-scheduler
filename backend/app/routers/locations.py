from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.auth_dependencies import get_current_admin
from app.database.connection import get_db
from app.schemas.location import (
    LocationCreate,
    LocationResponse,
    LocationUpdate,
)
from app.services import location_service


router = APIRouter(
    prefix="/locations",
    tags=["Locations"],
)


@router.get(
    "/",
    response_model=list[LocationResponse],
)
def get_locations(
    db: Session = Depends(get_db),
):
    return location_service.get_locations(db)


@router.post(
    "/",
    response_model=LocationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_admin)],
)
def create_location(
    data: LocationCreate,
    db: Session = Depends(get_db),
):
    return location_service.create_location(db, data)


@router.patch(
    "/{location_id}",
    response_model=LocationResponse,
    dependencies=[Depends(get_current_admin)],
)
def update_location(
    location_id: int,
    data: LocationUpdate,
    db: Session = Depends(get_db),
):
    return location_service.update_location(db, location_id, data)
