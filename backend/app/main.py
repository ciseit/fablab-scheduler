from fastapi import FastAPI

from app.database.connection import Base, engine
from app.models import technician
from app.routers import technicians
from app.routers.collection_campaigns import (
    router as collection_campaigns_router,
)


Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="FABLAB Scheduler API",
    description="Backend API for the FABLAB Scheduler.",
    version="0.1.0",
)


app.include_router(technicians.router)
app.include_router(collection_campaigns_router)


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