from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.database.connection import Base


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    schedule_id = Column(
        Integer,
        ForeignKey("schedules.id"),
        nullable=False,
        index=True,
    )

    shift_id = Column(
        Integer,
        ForeignKey("shifts.id"),
        nullable=False,
        index=True,
    )

    technician_id = Column(
        Integer,
        ForeignKey("technicians.id"),
        nullable=False,
        index=True,
    )

    status = Column(
        String(20),
        nullable=False,
        default="scheduled",
    )

    # Diana-configurable status/category for this assignment (Working, On
    # Leave, Training, etc.), shown with its color and its name. Optional
    # so assignments made before this feature keep working.
    category_id = Column(
        Integer,
        ForeignKey("schedule_categories.id"),
        nullable=True,
        index=True,
    )

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
