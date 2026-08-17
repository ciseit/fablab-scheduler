from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth_dependencies import get_current_admin
from app.database.connection import get_db
from app.schemas.notification import (
    NotificationListResponse,
    NotificationResponse,
)
from app.services import notification_service


router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
    dependencies=[Depends(get_current_admin)],
)


@router.get(
    "/",
    response_model=NotificationListResponse,
)
def get_notifications(
    db: Session = Depends(get_db),
):
    return notification_service.get_notifications(db)


@router.post(
    "/{notification_id}/read",
    response_model=NotificationResponse,
)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
):
    notification = notification_service.mark_notification_read(
        db, notification_id
    )

    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    return notification


@router.post(
    "/read-all",
    status_code=status.HTTP_204_NO_CONTENT,
)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
):
    notification_service.mark_all_read(db)
