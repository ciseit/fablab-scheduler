from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.auth_dependencies import get_current_admin
from app.database.connection import get_db
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentResponse,
    AssignmentUpdate,
    PublicScheduleResponse,
    ScheduleBoardResponse,
)
from app.schemas.schedule import (
    ScheduleCreate,
    ScheduleListResponse,
    ScheduleResponse,
    ScheduleUpdate,
)
from app.services import schedule_service, scheduling_service


router = APIRouter(
    prefix="/schedules",
    tags=["Schedules"],
)


@router.post(
    "/",
    response_model=ScheduleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_admin)],
)
def create_schedule_endpoint(
    schedule_data: ScheduleCreate,
    db: Session = Depends(get_db),
):
    return schedule_service.create_schedule(db, schedule_data)


@router.get(
    "/",
    response_model=list[ScheduleListResponse],
    dependencies=[Depends(get_current_admin)],
)
def list_schedules_endpoint(
    db: Session = Depends(get_db),
):
    return schedule_service.list_schedules(db)


@router.patch(
    "/{schedule_id}",
    response_model=ScheduleResponse,
    dependencies=[Depends(get_current_admin)],
)
def update_schedule_endpoint(
    schedule_id: int,
    schedule_data: ScheduleUpdate,
    db: Session = Depends(get_db),
):
    return schedule_service.update_schedule(db, schedule_id, schedule_data)


@router.post(
    "/generate/{schedule_id}",
    response_model=ScheduleBoardResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_admin)],
)
def generate_schedule_endpoint(
    schedule_id: int,
    db: Session = Depends(get_db),
):
    return scheduling_service.generate_schedule(
        db=db,
        schedule_id=schedule_id,
    )


@router.post(
    "/publish/{schedule_id}",
    response_model=ScheduleBoardResponse,
    dependencies=[Depends(get_current_admin)],
)
def publish_schedule_endpoint(
    schedule_id: int,
    db: Session = Depends(get_db),
):
    return scheduling_service.publish_schedule(
        db=db,
        schedule_id=schedule_id,
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
    "/{schedule_id}",
    response_model=ScheduleBoardResponse,
    dependencies=[Depends(get_current_admin)],
)
def get_schedule_endpoint(
    schedule_id: int,
    db: Session = Depends(get_db),
):
    return scheduling_service.get_schedule_board(
        db=db,
        schedule_id=schedule_id,
    )


@router.post(
    "/{schedule_id}/assignments",
    response_model=AssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_admin)],
)
def create_assignment_endpoint(
    schedule_id: int,
    assignment_data: AssignmentCreate,
    db: Session = Depends(get_db),
):
    return scheduling_service.create_assignment(
        db=db,
        schedule_id=schedule_id,
        data=assignment_data,
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
