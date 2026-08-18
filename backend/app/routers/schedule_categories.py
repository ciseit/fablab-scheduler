from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.auth_dependencies import get_current_admin
from app.database.connection import get_db
from app.schemas.schedule_category import (
    ScheduleCategoryCreate,
    ScheduleCategoryResponse,
    ScheduleCategoryUpdate,
)
from app.services import schedule_category_service


router = APIRouter(
    prefix="/schedule-categories",
    tags=["Schedule Categories"],
)


@router.get(
    "/",
    response_model=list[ScheduleCategoryResponse],
)
def get_schedule_categories(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
):
    return schedule_category_service.get_categories(
        db, include_inactive=include_inactive
    )


@router.post(
    "/",
    response_model=ScheduleCategoryResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_admin)],
)
def create_schedule_category(
    data: ScheduleCategoryCreate,
    db: Session = Depends(get_db),
):
    return schedule_category_service.create_category(db, data)


@router.patch(
    "/{category_id}",
    response_model=ScheduleCategoryResponse,
    dependencies=[Depends(get_current_admin)],
)
def update_schedule_category(
    category_id: int,
    data: ScheduleCategoryUpdate,
    db: Session = Depends(get_db),
):
    return schedule_category_service.update_category(db, category_id, data)
