import secrets

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.availability import Availability
from app.models.collection_campaign import CollectionCampaign
from app.models.shift import Shift
from app.models.technician import Technician
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


def get_total_active_technicians(db: Session) -> int:
    total_technicians = (
        db.query(func.count(Technician.id))
        .filter(Technician.status == "active")
        .scalar()
    )

    return int(total_technicians or 0)


def get_collection_campaigns(
    db: Session,
) -> list[dict]:
    campaigns = db.query(CollectionCampaign).all()

    total_active_technicians = get_total_active_technicians(db)

    campaign_counts = (
        db.query(
            Availability.campaign_id,
            func.count(
                func.distinct(Availability.technician_id)
            ).label("submitted_count"),
            func.count(Availability.id).label(
                "total_availability_blocks"
            ),
        )
        .group_by(Availability.campaign_id)
        .all()
    )

    counts_by_campaign = {
        campaign_id: {
            "submitted_count": int(submitted_count or 0),
            "total_availability_blocks": int(
                total_availability_blocks or 0
            ),
        }
        for (
            campaign_id,
            submitted_count,
            total_availability_blocks,
        ) in campaign_counts
    }

    campaign_responses = []

    for campaign in campaigns:
        counts = counts_by_campaign.get(
            campaign.id,
            {
                "submitted_count": 0,
                "total_availability_blocks": 0,
            },
        )

        campaign_responses.append(
            {
                "id": campaign.id,
                "name": campaign.name,
                "semester": campaign.semester,
                "opens_at": campaign.opens_at,
                "closes_at": campaign.closes_at,
                "minimum_weekly_hours": (
                    campaign.minimum_weekly_hours
                ),
                "public_token": campaign.public_token,
                "status": campaign.status,
                "submitted_count": counts["submitted_count"],
                "total_technicians": total_active_technicians,
                "total_availability_blocks": counts[
                    "total_availability_blocks"
                ],
            }
        )

    return campaign_responses


def get_collection_campaign_submission_summary(
    db: Session,
    campaign_id: int,
) -> dict:
    campaign = (
        db.query(CollectionCampaign)
        .filter(CollectionCampaign.id == campaign_id)
        .first()
    )

    if campaign is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability Request not found",
        )

    unique_technicians_submitted = (
        db.query(
            func.count(
                func.distinct(Availability.technician_id)
            )
        )
        .filter(Availability.campaign_id == campaign_id)
        .scalar()
    )

    total_availability_blocks = (
        db.query(func.count(Availability.id))
        .filter(Availability.campaign_id == campaign_id)
        .scalar()
    )

    total_active_technicians = get_total_active_technicians(db)

    return {
        "campaign_id": campaign.id,
        "unique_technicians_submitted": int(
            unique_technicians_submitted or 0
        ),
        "total_technicians": total_active_technicians,
        "total_availability_blocks": int(
            total_availability_blocks or 0
        ),
    }


def get_collection_campaign_roster(
    db: Session,
    campaign_id: int,
) -> dict:
    campaign = (
        db.query(CollectionCampaign)
        .filter(CollectionCampaign.id == campaign_id)
        .first()
    )

    if campaign is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability Request not found",
        )

    submitted_at_by_technician = dict(
        db.query(
            Availability.technician_id,
            func.min(Availability.created_at),
        )
        .filter(Availability.campaign_id == campaign_id)
        .group_by(Availability.technician_id)
        .all()
    )

    active_technicians = (
        db.query(Technician)
        .filter(Technician.status == "active")
        .order_by(Technician.name)
        .all()
    )

    submitted = []
    pending = []

    for technician in active_technicians:
        submitted_at = submitted_at_by_technician.get(technician.id)

        entry = {
            "technician_id": technician.id,
            "technician_name": technician.name,
            "submitted": submitted_at is not None,
            "submitted_at": submitted_at,
        }

        if submitted_at is not None:
            submitted.append(entry)
        else:
            pending.append(entry)

    submitted.sort(key=lambda entry: entry["technician_name"].lower())
    pending.sort(key=lambda entry: entry["technician_name"].lower())

    return {
        "campaign_id": campaign_id,
        "submitted": submitted,
        "pending": pending,
    }


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
        minimum_weekly_hours=(
            campaign_data.minimum_weekly_hours
        ),
        public_token=generate_unique_public_token(db),
        status="draft",
    )

    db.add(new_campaign)
    db.commit()
    db.refresh(new_campaign)

    return new_campaign


def delete_collection_campaign(
    db: Session,
    campaign_id: int,
) -> None:
    campaign = (
        db.query(CollectionCampaign)
        .filter(CollectionCampaign.id == campaign_id)
        .first()
    )

    if campaign is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability Request not found",
        )

    submission_count = (
        db.query(func.count(func.distinct(Availability.technician_id)))
        .filter(Availability.campaign_id == campaign_id)
        .scalar()
    ) or 0

    shift_count = (
        db.query(func.count(Shift.id))
        .filter(Shift.campaign_id == campaign_id)
        .scalar()
    ) or 0

    assignment_count = (
        db.query(func.count(Assignment.id))
        .filter(Assignment.campaign_id == campaign_id)
        .scalar()
    ) or 0

    if submission_count > 0 or shift_count > 0 or assignment_count > 0:
        blockers = []

        if submission_count > 0:
            blockers.append(
                f"{submission_count} technician "
                f"{'submission' if submission_count == 1 else 'submissions'}"
            )

        if shift_count > 0:
            blockers.append(
                f"{shift_count} {'shift' if shift_count == 1 else 'shifts'}"
            )

        if assignment_count > 0:
            blockers.append(
                f"{assignment_count} schedule "
                f"{'assignment' if assignment_count == 1 else 'assignments'}"
            )

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This availability request can't be deleted because it "
                "already has " + ", ".join(blockers) + ". Deleting it "
                "would permanently erase that data. Remove the related "
                "submissions, shifts, and schedule assignments first if "
                "you really need to delete this request."
            ),
        )

    db.delete(campaign)
    db.commit()