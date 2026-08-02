from sqlalchemy import Column, Integer, String, Time, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.database.connection import Base

class Availability(Base):
    __tablename__ = "availabilities"
    id = Column(Integer, primary_key=True, index=True)
    technician_id = Column(Integer, ForeignKey("technicians.id"), nullable=False)
    campaign_id = Column(Integer, nullable=False)
    day_of_week = Column(String(10), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    availability_type = Column(String(20), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())