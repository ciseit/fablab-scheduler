from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.schemas.collection_campaign import (
    CollectionCampaignCreate,
    CollectionCampaignResponse,
)
from app.services import collection_campaign_service


router = APIRouter(
    prefix="/collection-campaigns",
    tags=["Collection Campaigns"],
)


@router.get(
    "/",
    response_model=list[CollectionCampaignResponse],
)
def get_collection_campaigns(
    db: Session = Depends(get_db),
):
    return collection_campaign_service.get_collection_campaigns(db)


@router.post(
    "/",
    response_model=CollectionCampaignResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_collection_campaign(
    campaign_data: CollectionCampaignCreate,
    db: Session = Depends(get_db),
):
    if campaign_data.closes_at <= campaign_data.opens_at:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Closing time must be later than opening time.",
        )

    return collection_campaign_service.create_collection_campaign(
        db,
        campaign_data,
    )