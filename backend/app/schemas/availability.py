from datetime import time
from enum import Enum

from pydantic import BaseModel, ConfigDict, model_validator


class AvailabilityType(str, Enum):
    preferred = "preferred"
    available = "available"
    backup = "backup"
    restricted = "restricted"


class DayOfWeek(str, Enum):
    monday = "monday"
    tuesday = "tuesday"
    wednesday = "wednesday"
    thursday = "thursday"
    friday = "friday"
    saturday = "saturday"
    sunday = "sunday"


class AvailabilityBase(BaseModel):
    campaign_id: int
    day_of_week: DayOfWeek
    start_time: time
    end_time: time
    availability_type: AvailabilityType

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be later than start_time")
        return self


class AvailabilityCreate(AvailabilityBase):
    pass


class AvailabilityUpdate(BaseModel):
    campaign_id: int | None = None
    day_of_week: DayOfWeek | None = None
    start_time: time | None = None
    end_time: time | None = None
    availability_type: AvailabilityType | None = None

    @model_validator(mode="after")
    def validate_time_range(self):
        if (
            self.start_time is not None
            and self.end_time is not None
            and self.end_time <= self.start_time
        ):
            raise ValueError("end_time must be later than start_time")
        return self


class AvailabilityResponse(AvailabilityBase):
    id: int
    technician_id: int

    model_config = ConfigDict(from_attributes=True)