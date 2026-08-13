from sqlalchemy import Column, ForeignKey, Integer, String, Time

from app.database.connection import Base


class Shift(Base):
    __tablename__ = "shifts"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    campaign_id = Column(
        Integer,
        ForeignKey("collection_campaigns.id"),
        nullable=False,
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
