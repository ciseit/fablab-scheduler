from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.technician import Technician
from app.schemas.technician import TechnicianCreate, TechnicianUpdate


def create_technician(
    db: Session,
    technician_data: TechnicianCreate,
):
    existing_technician = (
        db.query(Technician)
        .filter(Technician.email == technician_data.email)
        .first()
    )

    if existing_technician:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A technician with this email already exists.",
        )

    technician = Technician(**technician_data.model_dump())

    db.add(technician)
    db.commit()
    db.refresh(technician)

    return technician


def get_all_technicians(db: Session):
    return db.query(Technician).all()


def get_technician_by_id(
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
            detail="Technician not found.",
        )

    return technician


def update_technician(
    db: Session,
    technician_id: int,
    technician_data: TechnicianUpdate,
):
    technician = get_technician_by_id(db, technician_id)

    update_data = technician_data.model_dump(exclude_unset=True)

    if "email" in update_data:
        email_owner = (
            db.query(Technician)
            .filter(
                Technician.email == update_data["email"],
                Technician.id != technician_id,
            )
            .first()
        )

        if email_owner:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Another technician already uses this email.",
            )

    for field, value in update_data.items():
        setattr(technician, field, value)

    db.commit()
    db.refresh(technician)

    return technician


def delete_technician(
    db: Session,
    technician_id: int,
):
    technician = get_technician_by_id(db, technician_id)

    db.delete(technician)
    db.commit()