from sqlalchemy import Boolean, Column, Integer, String

from app.database.connection import Base


class ScheduleCategory(Base):
    """
    A Diana-configurable status/category for an assignment (e.g. Working,
    On Leave, Called Off, Training), each with its own color. Colors are
    never the only way a status is communicated in the UI -- the name is
    always shown alongside the color.
    """

    __tablename__ = "schedule_categories"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(100), unique=True, nullable=False)

    # Hex color, e.g. "#16a34a".
    color = Column(String(20), nullable=False)

    is_active = Column(Boolean, nullable=False, default=True)
