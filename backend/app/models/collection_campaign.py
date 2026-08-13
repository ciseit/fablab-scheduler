from sqlalchemy import Column, DateTime, Integer, String

from app.database.connection import Base


class CollectionCampaign(Base):
    __tablename__ = "collection_campaigns"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(
        String(100),
        nullable=False,
    )

    semester = Column(
        String(50),
        nullable=False,
    )

    opens_at = Column(
        DateTime,
        nullable=False,
    )

    closes_at = Column(
        DateTime,
        nullable=False,
    )

    minimum_weekly_hours = Column(
        Integer,
        nullable=False,
        default=15,
    )

    public_token = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )

    status = Column(
        String(30),
        nullable=False,
        default="draft",
    )

    schedule_published_at = Column(
        DateTime,
        nullable=True,
    )

    schedule_public_token = Column(
        String(100),
        unique=True,
        nullable=True,
        index=True,
    )