import secrets

from fastapi import APIRouter, HTTPException, status

from app.schemas.collection_campaign import (
    CollectionCampaignCreate,
    CollectionCampaignResponse,
)


router = APIRouter(
    prefix="/collection-campaigns",
    tags=["Collection Campaigns"],
)


collection_campaigns = []


@router.get(
    "/",
    response_model=list[CollectionCampaignResponse],
)
def get_collection_campaigns():
    return collection_campaigns


@router.post(
    "/",
    response_model=CollectionCampaignResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_collection_campaign(
    campaign_data: CollectionCampaignCreate,
):
    if campaign_data.closes_at <= campaign_data.opens_at:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Closing time must be later than opening time.",
        )

    new_campaign = {
        "id": len(collection_campaigns) + 1,
        "public_token": secrets.token_urlsafe(12),
        "status": "draft",
        **campaign_data.model_dump(),
    }

    collection_campaigns.append(new_campaign)

    return new_campaign