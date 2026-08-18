from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


CampaignStatus = Literal["draft", "open", "closed", "archived"]


class CollectionCampaignCreate(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    semester: str = Field(min_length=3, max_length=50)
    opens_at: datetime
    closes_at: datetime
    minimum_weekly_hours: float = Field(
        default=15,
        ge=0,
        le=40,
    )


class CollectionCampaignUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=120)
    semester: str | None = Field(default=None, min_length=3, max_length=50)
    opens_at: datetime | None = None
    closes_at: datetime | None = None
    minimum_weekly_hours: float | None = Field(
        default=None,
        ge=0,
        le=40,
    )
    # Archiving reuses the existing status field (set to "archived") so a
    # request with technician submissions can be taken out of the active
    # list without deleting the submissions/schedules that block deletion.
    status: CampaignStatus | None = None


class CollectionCampaignResponse(CollectionCampaignCreate):
    id: int
    public_token: str
    status: CampaignStatus
    # Computed live from opens_at/closes_at (see CollectionCampaign.
    # is_accepting_submissions) -- not the same as `status`, which
    # nothing currently transitions away from "draft".
    is_accepting_submissions: bool
    has_opened: bool

    model_config = ConfigDict(from_attributes=True)


class CollectionCampaignListResponse(CollectionCampaignResponse):
    submitted_count: int
    total_technicians: int
    total_availability_blocks: int


class CollectionCampaignSubmissionSummary(BaseModel):
    campaign_id: int
    unique_technicians_submitted: int
    total_technicians: int
    total_availability_blocks: int


class TechnicianSubmissionStatus(BaseModel):
    technician_id: int
    technician_name: str
    submitted: bool
    submitted_at: datetime | None = None


class CollectionCampaignRosterResponse(BaseModel):
    campaign_id: int
    submitted: list[TechnicianSubmissionStatus]
    pending: list[TechnicianSubmissionStatus]