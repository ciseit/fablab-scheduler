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


def generate_unique_public_token() -> str:
    existing_tokens = {
        campaign["public_token"]
        for campaign in collection_campaigns
    }

    while True:
        token = secrets.token_urlsafe(12)

        if token not in existing_tokens:
            return token


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
        "public_token": generate_unique_public_token(),
        "status": "draft",
        **campaign_data.model_dump(),
    }

    collection_campaigns.append(new_campaign)

    return new_campaign