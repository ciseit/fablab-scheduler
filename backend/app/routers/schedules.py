from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.auth_dependencies import get_current_admin
from app.database.connection import get_db
from app.schemas.assignment import (
    AssignmentResponse,
    AssignmentUpdate,
    PublicScheduleResponse,
    ScheduleResponse,
)
from app.services import scheduling_service


router = APIRouter(
    prefix="/schedules",
    tags=["Schedules"],
)


@router.post(
    "/generate/{campaign_id}",
    response_model=ScheduleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_admin)],
)
def generate_schedule_endpoint(
    campaign_id: int,
    db: Session = Depends(get_db),
):
    return scheduling_service.generate_schedule(
        db=db,
        campaign_id=campaign_id,
    )


@router.post(
    "/publish/{campaign_id}",
    response_model=ScheduleResponse,
    dependencies=[Depends(get_current_admin)],
)
def publish_schedule_endpoint(
    campaign_id: int,
    db: Session = Depends(get_db),
):
    return scheduling_service.publish_schedule(
        db=db,
        campaign_id=campaign_id,
    )


@router.get(
    "/public/{public_token}",
    response_model=PublicScheduleResponse,
)
def get_public_schedule_endpoint(
    public_token: str,
    db: Session = Depends(get_db),
):
    return scheduling_service.get_public_schedule(
        db=db,
        public_token=public_token,
    )


@router.get(
    "/{campaign_id}",
    response_model=ScheduleResponse,
    dependencies=[Depends(get_current_admin)],
)
def get_schedule_endpoint(
    campaign_id: int,
    db: Session = Depends(get_db),
):
    return scheduling_service.get_schedule(
        db=db,
        campaign_id=campaign_id,
    )


@router.patch(
    "/assignments/{assignment_id}",
    response_model=AssignmentResponse,
    dependencies=[Depends(get_current_admin)],
)
def edit_assignment_endpoint(
    assignment_id: int,
    assignment_update: AssignmentUpdate,
    db: Session = Depends(get_db),
):
    return scheduling_service.edit_assignment(
        db=db,
        assignment_id=assignment_id,
        update=assignment_update,
    )
