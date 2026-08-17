from datetime import time
from enum import Enum

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    model_validator,
)


class DayOfWeek(str, Enum):
    monday = "monday"
    tuesday = "tuesday"
    wednesday = "wednesday"
    thursday = "thursday"
    friday = "friday"
    saturday = "saturday"
    sunday = "sunday"


class AvailabilityType(str, Enum):
    preferred = "preferred"
    available = "available"
    backup = "backup"
    restricted = "restricted"


class AvailabilityBase(BaseModel):
    campaign_id: int = Field(gt=0)
    day_of_week: DayOfWeek
    start_time: time
    end_time: time
    availability_type: AvailabilityType

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.end_time <= self.start_time:
            raise ValueError(
                "end_time must be later than start_time"
            )

        return self


class AvailabilityCreate(AvailabilityBase):
    pass


class AvailabilityUpdate(BaseModel):
    campaign_id: int | None = Field(
        default=None,
        gt=0,
    )
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
            raise ValueError(
                "end_time must be later than start_time"
            )

        return self


class AvailabilityResponse(AvailabilityBase):
    id: int
    technician_id: int

    model_config = ConfigDict(from_attributes=True)


class PublicAvailabilityBlock(BaseModel):
    day_of_week: DayOfWeek
    start_time: time
    end_time: time
    availability_type: AvailabilityType

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.end_time <= self.start_time:
            raise ValueError(
                "end_time must be later than start_time"
            )

        return self


class PublicAvailabilitySubmission(BaseModel):
    email: EmailStr

    availability_blocks: list[PublicAvailabilityBlock] = Field(
        min_length=1
    )

    # When a technician has already submitted availability for this
    # request, the backend rejects the new submission unless this is set,
    # in which case the previous submission is replaced (not merged) with
    # the new one.
    replace_existing: bool = False