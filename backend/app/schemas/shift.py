from datetime import time

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.availability import DayOfWeek


class ShiftBase(BaseModel):
    campaign_id: int = Field(gt=0)
    day_of_week: DayOfWeek
    start_time: time
    end_time: time
    required_technicians: int = Field(default=1, ge=1, le=20)

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.end_time <= self.start_time:
            raise ValueError(
                "end_time must be later than start_time"
            )

        return self


class ShiftCreate(ShiftBase):
    pass


class ShiftResponse(ShiftBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
