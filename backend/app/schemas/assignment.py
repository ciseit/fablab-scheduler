from datetime import datetime, time

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.availability import DayOfWeek


class AssignmentResponse(BaseModel):
    id: int
    schedule_id: int
    shift_id: int
    technician_id: int
    status: str
    category_id: int | None

    model_config = ConfigDict(from_attributes=True)


class AssignmentCreate(BaseModel):
    shift_id: int = Field(gt=0)
    technician_id: int = Field(gt=0)
    category_id: int | None = Field(default=None, gt=0)


class AssignmentUpdate(BaseModel):
    technician_id: int | None = Field(default=None, gt=0)
    category_id: int | None = Field(default=None, gt=0)
    # Explicit flag so "clear the category" can be distinguished from
    # "leave it unchanged" (both look like `category_id: null` otherwise).
    clear_category: bool = False


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


class ScheduleBoardResponse(BaseModel):
    """The full working view of one schedule: its assignments plus the
    coverage/hours summary used by the Schedule Builder."""

    schedule_id: int
    assignments: list[AssignmentResponse]
    technicians_below_minimum: list[TechnicianHoursSummary]
    uncovered_shifts: list[UncoveredShift]
    published: bool
    public_token: str | None
    minimum_weekly_hours: float


class PublicAssignment(BaseModel):
    shift_id: int
    day_of_week: DayOfWeek
    start_time: time
    end_time: time
    technician_name: str
    location_name: str | None = None
    category_name: str | None = None
    category_color: str | None = None


class PublicTechnicianHours(BaseModel):
    technician_name: str
    assigned_hours: float


class PublicScheduleResponse(BaseModel):
    schedule_name: str
    semester: str | None
    published_at: datetime
    assignments: list[PublicAssignment]
    technician_hours: list[PublicTechnicianHours]
