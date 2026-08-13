from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth_dependencies import get_current_admin
from app.database.connection import get_db
from app.schemas.collection_campaign import (
    CollectionCampaignCreate,
    CollectionCampaignListResponse,
    CollectionCampaignResponse,
    CollectionCampaignSubmissionSummary,
)
from app.services import collection_campaign_service


router = APIRouter(
    prefix="/collection-campaigns",
    tags=["Collection Campaigns"],
)


@router.get(
    "/",
    response_model=list[CollectionCampaignListResponse],
    dependencies=[Depends(get_current_admin)],
)
def get_collection_campaigns(
    db: Session = Depends(get_db),
):
    return collection_campaign_service.get_collection_campaigns(
        db
    )


@router.get(
    "/{campaign_id}/submission-summary",
    response_model=CollectionCampaignSubmissionSummary,
    dependencies=[Depends(get_current_admin)],
)
def get_collection_campaign_submission_summary(
    campaign_id: int,
    db: Session = Depends(get_db),
):
    return (
        collection_campaign_service
        .get_collection_campaign_submission_summary(
            db=db,
            campaign_id=campaign_id,
        )
    )


@router.get(
    "/public/{public_token}",
    response_model=CollectionCampaignResponse,
)
def get_public_collection_campaign(
    public_token: str,
    db: Session = Depends(get_db),
):
    campaign = (
        collection_campaign_service
        .get_collection_campaign_by_public_token(
            db,
            public_token,
        )
    )

    if campaign is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability Request not found",
        )

    return campaign


@router.post(
    "/",
    response_model=CollectionCampaignResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_admin)],
)
def create_collection_campaign(
    campaign_data: CollectionCampaignCreate,
    db: Session = Depends(get_db),
):
    if campaign_data.closes_at <= campaign_data.opens_at:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Closing time must be later than opening time."
            ),
        )

    return (
        collection_campaign_service
        .create_collection_campaign(
            db,
            campaign_data,
        )
    )