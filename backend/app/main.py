from fastapi import FastAPI

from app.database.connection import Base, engine
from app.models import availability
from app.models import collection_campaign
from app.models import technician
from app.routers import availability as availability_router
from app.routers import collection_campaigns
from app.routers import technicians


# Create database tables for all imported SQLAlchemy models.
Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="FABLAB Scheduler API",
    description="Backend API for the FABLAB Scheduler.",
    version="0.1.0",
)


# Register API routers.
app.include_router(technicians.router)
app.include_router(availability_router.router)
app.include_router(collection_campaigns.router)


@app.get("/")
def home() -> dict[str, str]:
    return {
        "message": "Welcome to FABLAB Scheduler API",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "OK",
        "message": "Backend is running successfully",
    }