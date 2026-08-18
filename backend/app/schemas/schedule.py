from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ScheduleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    start_date: date | None = None
    end_date: date | None = None
    semester: str | None = Field(default=None, max_length=50)
    notes: str | None = Field(default=None, max_length=2000)
    minimum_weekly_hours: float = Field(default=15.0, ge=0, le=80)

    # Optional: link this schedule to an Availability Request so
    # automatic generation can use its submissions. Leave unset to build
    # a schedule entirely by hand.
    campaign_id: int | None = Field(default=None, gt=0)


class ScheduleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    start_date: date | None = None
    end_date: date | None = None
    semester: str | None = Field(default=None, max_length=50)
    notes: str | None = Field(default=None, max_length=2000)
    minimum_weekly_hours: float | None = Field(default=None, ge=0, le=80)
    campaign_id: int | None = Field(default=None, gt=0)


class ScheduleResponse(BaseModel):
    id: int
    name: str
    start_date: date | None
    end_date: date | None
    semester: str | None
    notes: str | None
    minimum_weekly_hours: float
    campaign_id: int | None
    status: str
    published_at: datetime | None
    public_token: str | None
    # Set only on a working copy created via "Edit Published Schedule";
    # points back at the published schedule it was cloned from.
    editing_source_id: int | None = None

    model_config = ConfigDict(from_attributes=True)


class ScheduleListResponse(ScheduleResponse):
    campaign_name: str | None = None
    shift_count: int = 0
    assignment_count: int = 0
