from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


CampaignStatus = Literal["draft", "open", "closed"]


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


class CollectionCampaignResponse(CollectionCampaignCreate):
    id: int
    public_token: str
    status: CampaignStatus

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