from datetime import datetime, time

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.availability import DayOfWeek


class AssignmentResponse(BaseModel):
    id: int
    campaign_id: int
    shift_id: int
    technician_id: int
    status: str

    model_config = ConfigDict(from_attributes=True)


class AssignmentUpdate(BaseModel):
    technician_id: int = Field(gt=0)


class TechnicianHoursSummary(BaseModel):
    technician_id: int
    technician_name: str
    assigned_hours: float
    shortfall_hours: float


class UncoveredShift(BaseModel):
    shift_id: int
    day_of_week: DayOfWeek
    start_time: time
    end_time: time
    required_technicians: int
    assigned_technicians: int
    shortfall: int


class ScheduleResponse(BaseModel):
    campaign_id: int
    assignments: list[AssignmentResponse]
    technicians_below_minimum: list[TechnicianHoursSummary]
    uncovered_shifts: list[UncoveredShift]
    published: bool
    public_token: str | None


class PublicAssignment(BaseModel):
    shift_id: int
    day_of_week: DayOfWeek
    start_time: time
    end_time: time
    technician_name: str


class PublicTechnicianHours(BaseModel):
    technician_name: str
    assigned_hours: float


class PublicScheduleResponse(BaseModel):
    campaign_name: str
    semester: str
    published_at: datetime
    assignments: list[PublicAssignment]
    technician_hours: list[PublicTechnicianHours]
