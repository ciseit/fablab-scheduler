from sqlalchemy import Column, Integer, String, Float

from app.database.connection import Base


class Technician(Base):
    __tablename__ = "technicians"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False)

    email = Column(String, unique=True, nullable=False)

    designation = Column(String(100), nullable=False)

    status = Column(String(20), default="active")

    weekly_target_hours = Column(Float, default=15.0)

    assignment_type = Column(String(100), nullable=True)

    notes = Column(String, nullable=True)