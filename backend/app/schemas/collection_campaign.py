from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


CampaignStatus = Literal["draft", "open", "closed"]


class CollectionCampaignCreate(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    semester: str = Field(min_length=3, max_length=50)
    opens_at: datetime
    closes_at: datetime
    minimum_weekly_hours: float = Field(default=15, ge=0, le=40)


class CollectionCampaignResponse(CollectionCampaignCreate):
    id: int
    public_token: str
    status: CampaignStatus