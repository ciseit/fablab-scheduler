from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.auth_dependencies import get_current_admin
from app.database.connection import get_db
from app.schemas.shift import ShiftCreate, ShiftResponse
from app.services import shift_service


router = APIRouter(
    prefix="/shifts",
    tags=["Shifts"],
    dependencies=[Depends(get_current_admin)],
)


@router.post(
    "/",
    response_model=ShiftResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_shift(
    shift_data: ShiftCreate,
    db: Session = Depends(get_db),
):
    return shift_service.create_shift(db, shift_data)


@router.get(
    "/",
    response_model=list[ShiftResponse],
)
def get_shifts(
    campaign_id: int = Query(gt=0),
    db: Session = Depends(get_db),
):
    return shift_service.get_shifts_for_campaign(db, campaign_id)


@router.get(
    "/{shift_id}",
    response_model=ShiftResponse,
)
def get_shift(
    shift_id: int,
    db: Session = Depends(get_db),
):
    return shift_service.get_shift_by_id(db, shift_id)
