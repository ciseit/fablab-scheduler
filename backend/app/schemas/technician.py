from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


TechnicianStatus = Literal["active", "inactive", "on_leave"]


class TechnicianBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    designation: str = Field(min_length=1, max_length=100)
    status: TechnicianStatus = "active"
    weekly_target_hours: float = Field(default=15.0, ge=0, le=80)
    # Category of this technician's placement (e.g. FABLAB, School Site,
    # Event, Outreach, Training).
    assignment_type: str | None = Field(default=None, max_length=100)
    # The specific site/project name for that placement (e.g. Carson High
    # School, Robotics Workshop).
    assignment_name: str | None = Field(default=None, max_length=150)
    notes: str | None = Field(default=None, max_length=1000)


class TechnicianCreate(TechnicianBase):
    pass


class TechnicianUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    designation: str | None = Field(default=None, min_length=1, max_length=100)
    status: TechnicianStatus | None = None
    weekly_target_hours: float | None = Field(default=None, ge=0, le=80)
    assignment_type: str | None = Field(default=None, max_length=100)
    assignment_name: str | None = Field(default=None, max_length=150)
    notes: str | None = Field(default=None, max_length=1000)


class TechnicianResponse(TechnicianBase):
    id: int

    model_config = ConfigDict(from_attributes=True)