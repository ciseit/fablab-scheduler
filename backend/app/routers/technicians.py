from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.schemas.technician import (
    TechnicianCreate,
    TechnicianResponse,
    TechnicianUpdate,
)
from app.services import technician_service


router = APIRouter(
    prefix="/technicians",
    tags=["Technicians"],
)


@router.post(
    "/",
    response_model=TechnicianResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_technician(
    technician_data: TechnicianCreate,
    db: Session = Depends(get_db),
):
    return technician_service.create_technician(
        db,
        technician_data,
    )


@router.get(
    "/",
    response_model=list[TechnicianResponse],
)
def get_technicians(
    db: Session = Depends(get_db),
):
    return technician_service.get_all_technicians(db)


@router.get(
    "/{technician_id}",
    response_model=TechnicianResponse,
)
def get_technician(
    technician_id: int,
    db: Session = Depends(get_db),
):
    return technician_service.get_technician_by_id(
        db,
        technician_id,
    )


@router.patch(
    "/{technician_id}",
    response_model=TechnicianResponse,
)
def update_technician(
    technician_id: int,
    technician_data: TechnicianUpdate,
    db: Session = Depends(get_db),
):
    return technician_service.update_technician(
        db,
        technician_id,
        technician_data,
    )


@router.delete(
    "/{technician_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_technician(
    technician_id: int,
    db: Session = Depends(get_db),
):
    technician_service.delete_technician(
        db,
        technician_id,
    )

    return None