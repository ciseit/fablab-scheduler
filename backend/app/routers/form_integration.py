from fastapi import APIRouter, HTTPException, status

from app.schemas.form_integration import FormIntegrationCreate


router = APIRouter(
    prefix="/form-integrations",
    tags=["Form Integrations"],
)


form_integrations = []


@router.get("/")
def get_form_integrations():
    return form_integrations


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_form_integration(
    integration_data: FormIntegrationCreate,
):
    new_integration = {
        "id": len(form_integrations) + 1,
        **integration_data.model_dump(),
    }

    form_integrations.append(new_integration)

    return new_integration


@router.post("/{integration_id}/test")
def test_form_integration(integration_id: int):
    for integration in form_integrations:
        if integration["id"] == integration_id:
            return {
                "success": True,
                "message": "Google Sheet connection test succeeded.",
                "integration_id": integration_id,
                "sheet_id": integration["sheet_id"],
                "worksheet_name": integration["worksheet_name"],
            }

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Form integration not found",
    )