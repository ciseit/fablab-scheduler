import secrets

from sqlalchemy.orm import Session

from app.models.collection_campaign import CollectionCampaign
from app.schemas.collection_campaign import CollectionCampaignCreate


def generate_unique_public_token(db: Session) -> str:
    while True:
        token = secrets.token_urlsafe(12)

        existing_campaign = (
            db.query(CollectionCampaign)
            .filter(CollectionCampaign.public_token == token)
            .first()
        )

        if existing_campaign is None:
            return token


def get_collection_campaigns(
    db: Session,
) -> list[CollectionCampaign]:
    return db.query(CollectionCampaign).all()


def get_collection_campaign_by_public_token(
    db: Session,
    public_token: str,
) -> CollectionCampaign | None:
    return (
        db.query(CollectionCampaign)
        .filter(CollectionCampaign.public_token == public_token)
        .first()
    )


def create_collection_campaign(
    db: Session,
    campaign_data: CollectionCampaignCreate,
) -> CollectionCampaign:
    new_campaign = CollectionCampaign(
        name=campaign_data.name,
        semester=campaign_data.semester,
        opens_at=campaign_data.opens_at,
        closes_at=campaign_data.closes_at,
        minimum_weekly_hours=campaign_data.minimum_weekly_hours,
        public_token=generate_unique_public_token(db),
        status="draft",
    )

    db.add(new_campaign)
    db.commit()
    db.refresh(new_campaign)

    return new_campaign