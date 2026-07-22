from fastapi import FastAPI

from app.routers.form_integration import router as form_integration_router


app = FastAPI(
    title="FABLAB Scheduler API",
    description="Backend API for the FABLAB Smart Scheduler.",
    version="0.1.0",
)

app.include_router(form_integration_router)


@app.get("/")
def home():
    return {
        "message": "Welcome to FABLAB Scheduler API"
    }


@app.get("/health")
def health():
    return {
        "status": "OK",
        "message": "Backend is running successfully",
    }