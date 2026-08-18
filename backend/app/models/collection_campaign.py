from datetime import datetime, timezone

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

    @property
    def has_opened(self) -> bool:
        """
        Whether `opens_at` has been reached yet. Naive stored values are
        treated as UTC (see `is_accepting_submissions`) -- the frontend
        is responsible for converting the admin's local wall-clock entry
        to UTC digits before it is ever stored.
        """
        opens_at = self.opens_at

        if opens_at.tzinfo is None:
            opens_at = opens_at.replace(tzinfo=timezone.utc)

        return datetime.now(timezone.utc) >= opens_at

    @property
    def is_accepting_submissions(self) -> bool:
        """
        Computed, not stored: `status` is a separate, currently-unused
        field (always "draft" -- see Phase 1 findings) that nothing sets
        based on dates. This is the actual window check, derived live
        from opens_at/closes_at every time it's read, so changing either
        immediately takes effect with no extra bookkeeping.
        """
        closes_at = self.closes_at

        if closes_at.tzinfo is None:
            closes_at = closes_at.replace(tzinfo=timezone.utc)

        return self.has_opened and datetime.now(timezone.utc) <= closes_at