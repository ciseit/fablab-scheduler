from fastapi import FastAPI
from app.database.connection import Base, engine
from app.models import technician
from app.routers import technicians
from app.models import availability
from app.routers import availability

Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="FABLAB Scheduler API",
    description="Backend API for the FABLAB Scheduler.",
    version="0.1.0",
)


app.include_router(technicians.router)
app.include_router(availability.router)

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

