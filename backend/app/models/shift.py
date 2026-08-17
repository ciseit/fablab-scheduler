from sqlalchemy import Column, ForeignKey, Integer, String, Time

from app.database.connection import Base


class Shift(Base):
    __tablename__ = "shifts"

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

    # The site this shift takes place at (e.g. FABLAB, a school site, an
    # outreach event). Optional so existing shifts without a location keep
    # working.
    location_id = Column(
        Integer,
        ForeignKey("locations.id"),
        nullable=True,
        index=True,
    )

    day_of_week = Column(
        String(10),
        nullable=False,
    )

    start_time = Column(
        Time,
        nullable=False,
    )

    end_time = Column(
        Time,
        nullable=False,
    )

    required_technicians = Column(
        Integer,
        nullable=False,
        default=1,
    )
