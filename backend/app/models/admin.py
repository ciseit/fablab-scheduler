from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func

from app.database.connection import Base


class Admin(Base):
    __tablename__ = "admins"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    full_name = Column(
        String(120),
        nullable=False,
    )

    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    password_hash = Column(
        String(255),
        nullable=False,
    )

    role = Column(
        String(30),
        nullable=False,
        default="admin",
        server_default="admin",
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )