from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.availability import Availability
from app.models.collection_campaign import CollectionCampaign
from app.models.notification import Notification
from app.models.schedule import Schedule
from app.services import scheduling_service
from app.services.collection_campaign_service import (
    get_total_active_technicians,
)


DEADLINE_WARNING_WINDOW = timedelta(hours=48)


def create_or_touch_notification(
    db: Session,
    *,
    dedupe_key: str,
    type: str,
    title: str,
    message: str,
    link: str | None = None,
) -> None:
    existing = (
        db.query(Notification)
        .filter(Notification.dedupe_key == dedupe_key)
        .first()
    )

    if existing is not None:
        # Refresh the content but leave is_read alone: if Diana already
        # acknowledged this exact condition, re-touching it on every page
        # load must not resurrect it as "unread" noise.
        existing.title = title
        existing.message = message
        existing.link = link
        db.commit()
        return

    notification = Notification(
        dedupe_key=dedupe_key,
        type=type,
        title=title,
        message=message,
        link=link,
        is_read=False,
    )

    db.add(notification)
    db.commit()


def clear_notification(db: Session, dedupe_key: str) -> None:
    db.query(Notification).filter(
        Notification.dedupe_key == dedupe_key
    ).delete(synchronize_session=False)
    db.commit()


def notify_availability_submitted(
    db: Session,
    campaign: CollectionCampaign,
    technician_name: str,
    technician_id: int,
) -> None:
    create_or_touch_notification(
        db,
        dedupe_key=f"submitted:{campaign.id}:{technician_id}",
        type="availability_submitted",
        title="Availability submitted",
        message=(
            f"{technician_name} submitted availability for "
            f'"{campaign.name}".'
        ),
        link="/availability-requests",
    )


def notify_duplicate_submission(
    db: Session,
    campaign: CollectionCampaign,
    technician_name: str,
    technician_id: int,
) -> None:
    create_or_touch_notification(
        db,
        dedupe_key=f"duplicate:{campaign.id}:{technician_id}",
        type="duplicate_submission",
        title="Duplicate submission blocked",
        message=(
            f"{technician_name} tried to submit availability again for "
            f'"{campaign.name}". Their previous submission was kept.'
        ),
        link="/availability-requests",
    )


def refresh_state_notifications(db: Session) -> None:
    """
    Re-evaluates state-based conditions (deadlines, uncovered shifts,
    technicians below minimum hours) and upserts or clears notifications
    to match current reality. Safe to call on every notifications read;
    dedupe_key upserts mean this never creates duplicate noise.
    """

    _refresh_deadline_notifications(db)
    _refresh_schedule_notifications(db)


def _refresh_deadline_notifications(db: Session) -> None:
    now = datetime.now(timezone.utc)
    total_active = get_total_active_technicians(db)

    campaigns = db.query(CollectionCampaign).all()

    for campaign in campaigns:
        dedupe_key = f"deadline:{campaign.id}"

        closes_at = campaign.closes_at
        if closes_at.tzinfo is None:
            closes_at = closes_at.replace(tzinfo=timezone.utc)

        submitted_count = (
            db.query(Availability.technician_id)
            .filter(Availability.campaign_id == campaign.id)
            .distinct()
            .count()
        )

        missing = max(total_active - submitted_count, 0)

        is_approaching = (
            campaign.status not in ("closed", "archived")
            and now <= closes_at <= now + DEADLINE_WARNING_WINDOW
            and missing > 0
        )

        if not is_approaching:
            clear_notification(db, dedupe_key)
            continue

        hours_left = max(
            int((closes_at - now).total_seconds() // 3600), 0
        )

        create_or_touch_notification(
            db,
            dedupe_key=dedupe_key,
            type="deadline_approaching",
            title="Availability deadline approaching",
            message=(
                f'"{campaign.name}" closes in about {hours_left} '
                f"hour{'s' if hours_left != 1 else ''}, and {missing} "
                f"technician{'s' if missing != 1 else ''} still "
                "haven't submitted."
            ),
            link="/availability-requests",
        )


def _refresh_schedule_notifications(db: Session) -> None:
    schedules = db.query(Schedule).all()

    for schedule in schedules:
        uncovered_key = f"uncovered:{schedule.id}"
        below_minimum_key = f"below_minimum:{schedule.id}"

        board = scheduling_service.get_schedule_board(db, schedule.id)

        if board["uncovered_shifts"]:
            count = len(board["uncovered_shifts"])
            create_or_touch_notification(
                db,
                dedupe_key=uncovered_key,
                type="uncovered_shifts",
                title="Schedule has uncovered shifts",
                message=(
                    f'"{schedule.name}" has {count} '
                    f"shift{'s' if count != 1 else ''} that still "
                    "need more technicians."
                ),
                link=f"/schedule-builder?scheduleId={schedule.id}",
            )
        else:
            clear_notification(db, uncovered_key)

        if board["technicians_below_minimum"]:
            count = len(board["technicians_below_minimum"])
            create_or_touch_notification(
                db,
                dedupe_key=below_minimum_key,
                type="below_minimum_hours",
                title="Technicians need more hours",
                message=(
                    f'"{schedule.name}": {count} '
                    f"technician{'s' if count != 1 else ''} below the "
                    f"required {schedule.minimum_weekly_hours}-hour "
                    "weekly minimum."
                ),
                link=f"/schedule-builder?scheduleId={schedule.id}",
            )
        else:
            clear_notification(db, below_minimum_key)


def get_notifications(db: Session, limit: int = 50) -> dict:
    refresh_state_notifications(db)

    notifications = (
        db.query(Notification)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )

    unread_count = (
        db.query(Notification)
        .filter(Notification.is_read.is_(False))
        .count()
    )

    return {
        "unread_count": unread_count,
        "notifications": notifications,
    }


def mark_notification_read(db: Session, notification_id: int) -> Notification | None:
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id)
        .first()
    )

    if notification is None:
        return None

    notification.is_read = True
    db.commit()
    db.refresh(notification)

    return notification


def mark_all_read(db: Session) -> None:
    db.query(Notification).filter(Notification.is_read.is_(False)).update(
        {"is_read": True}
    )
    db.commit()


def dismiss_notification(db: Session, notification_id: int) -> bool:
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id)
        .first()
    )

    if notification is None:
        return False

    db.delete(notification)
    db.commit()

    return True


def clear_read_notifications(db: Session) -> None:
    db.query(Notification).filter(Notification.is_read.is_(True)).delete(
        synchronize_session=False
    )
    db.commit()
