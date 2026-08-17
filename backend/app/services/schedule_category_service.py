from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.schedule_category import ScheduleCategory
from app.schemas.schedule_category import (
    ScheduleCategoryCreate,
    ScheduleCategoryUpdate,
)


def _lower_eq(column, value):
    return func.lower(column) == value.strip().lower()


def create_category(
    db: Session, data: ScheduleCategoryCreate
) -> ScheduleCategory:
    existing = (
        db.query(ScheduleCategory)
        .filter(_lower_eq(ScheduleCategory.name, data.name))
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A category with this name already exists.",
        )

    category = ScheduleCategory(
        name=data.name, color=data.color, is_active=True
    )

    db.add(category)
    db.commit()
    db.refresh(category)

    return category


def get_categories(
    db: Session, include_inactive: bool = True
) -> list[ScheduleCategory]:
    query = db.query(ScheduleCategory)

    if not include_inactive:
        query = query.filter(ScheduleCategory.is_active.is_(True))

    return query.order_by(ScheduleCategory.name).all()


def get_category_or_404(db: Session, category_id: int) -> ScheduleCategory:
    category = (
        db.query(ScheduleCategory)
        .filter(ScheduleCategory.id == category_id)
        .first()
    )

    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    return category


def update_category(
    db: Session,
    category_id: int,
    data: ScheduleCategoryUpdate,
) -> ScheduleCategory:
    category = get_category_or_404(db, category_id)

    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data:
        existing = (
            db.query(ScheduleCategory)
            .filter(
                _lower_eq(ScheduleCategory.name, update_data["name"]),
                ScheduleCategory.id != category_id,
            )
            .first()
        )

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A category with this name already exists.",
            )

    for field, value in update_data.items():
        setattr(category, field, value)

    db.commit()
    db.refresh(category)

    return category
