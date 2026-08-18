from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.database.connection import Base


class Schedule(Base):
    """
    A schedule has its own identity and can optionally be linked to a
    CollectionCampaign (Availability Request) for automatic generation.
    A schedule with no linked campaign is built entirely by hand.
    """

    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(150), nullable=False)

    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    semester = Column(String(50), nullable=True)
    notes = Column(String, nullable=True)

    minimum_weekly_hours = Column(Float, nullable=False, default=15.0)

    # Optional link to the Availability Request this schedule was built
    # from. Null means this schedule was created directly, with no
    # availability collection behind it.
    campaign_id = Column(
        Integer,
        ForeignKey("collection_campaigns.id"),
        nullable=True,
        index=True,
    )

    status = Column(String(30), nullable=False, default="draft")

    published_at = Column(DateTime, nullable=True)

    public_token = Column(
        String(100),
        unique=True,
        nullable=True,
        index=True,
    )

    # Set only on a schedule created via "Edit Published Schedule": points
    # back at the published schedule it's a working copy of. Diana edits
    # this draft freely; the original stays untouched and public until
    # she republishes, at which point the original's status flips to
    # "superseded" and its public_token moves to this row. Null for every
    # ordinary schedule (standalone or campaign-linked).
    editing_source_id = Column(
        Integer,
        ForeignKey("schedules.id"),
        nullable=True,
        index=True,
    )

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )
