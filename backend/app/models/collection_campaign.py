from sqlalchemy import Column, DateTime, Float, Integer, String

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
        Float,
        nullable=False,
        default=15.0,
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

    # Publishing state now lives on Schedule (a campaign can have zero,
    # one, or more schedules built from it). The old schedule_published_at
    # / schedule_public_token columns may still physically exist on
    # existing databases from before this model was introduced; they are
    # simply unmapped and unused now.