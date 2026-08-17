from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.sql import func

from app.database.connection import Base


class Notification(Base):
    """
    An actionable event for the administrator (Diana), e.g. a technician
    submitted availability, a duplicate submission was blocked, a
    deadline is approaching, or a schedule has uncovered shifts.

    `dedupe_key` lets a service avoid re-creating the same noisy
    notification over and over (e.g. re-flagging the same uncovered
    shift on every page load) -- callers upsert on this key instead of
    always inserting.
    """

    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)

    # Category of event, e.g. "availability_submitted",
    # "duplicate_submission", "deadline_approaching", "uncovered_shifts",
    # "below_minimum_hours".
    type = Column(String(50), nullable=False)

    title = Column(String(200), nullable=False)
    message = Column(String(500), nullable=False)

    # Relative link to the relevant page, e.g. "/availability-requests".
    link = Column(String(300), nullable=True)

    is_read = Column(Boolean, nullable=False, default=False)

    # Unique per logical event so repeated checks don't spam duplicate
    # notifications for the same underlying condition.
    dedupe_key = Column(
        String(200),
        unique=True,
        nullable=False,
        index=True,
    )

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
        index=True,
    )
