from sqlalchemy import Boolean, Column, Integer, String

from app.database.connection import Base


class Location(Base):
    """
    A site/location a shift can take place at (e.g. FABLAB, Carson High
    School, an outreach event). Diana manages this list herself instead
    of it being a fixed set of choices.
    """

    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(150), unique=True, nullable=False)

    is_active = Column(Boolean, nullable=False, default=True)
