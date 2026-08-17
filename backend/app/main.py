import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.connection import Base, engine, run_startup_migrations

load_dotenv()

from app.models import admin
from app.models import assignment
from app.models import availability
from app.models import collection_campaign
from app.models import location
from app.models import schedule
from app.models import schedule_category
from app.models import shift
from app.models import technician

from app.routers import auth
from app.routers import availability as availability_router
from app.routers import locations as locations_router
from app.routers import schedule_categories as schedule_categories_router
from app.routers import schedules as schedules_router
from app.routers import shifts as shifts_router
from app.routers import technicians
from app.routers.collection_campaigns import (
    router as collection_campaigns_router,
)


Base.metadata.create_all(bind=engine)
run_startup_migrations()


app = FastAPI(
    title="FABLAB Scheduler API",
    description="Backend API for the FABLAB Scheduler.",
    version="0.1.0",
)


default_allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

extra_allowed_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

allowed_origins = default_allowed_origins + extra_allowed_origins


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(technicians.router)
app.include_router(availability_router.router)
app.include_router(collection_campaigns_router)
app.include_router(shifts_router.router)
app.include_router(schedules_router.router)
app.include_router(locations_router.router)
app.include_router(schedule_categories_router.router)


@app.get("/")
def home():
    return {
        "message": "FABLAB Scheduler API is running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }