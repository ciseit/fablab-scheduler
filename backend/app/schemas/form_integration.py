from typing import Literal

from pydantic import BaseModel, Field


FormType = Literal[
    "technician_registration",
    "semester_schedule",
    "availability",
    "leave_request",
    "call_off",
]


class FormIntegrationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    sheet_id: str = Field(min_length=5)
    worksheet_name: str = Field(default="Form Responses 1")
    form_type: FormType
    is_active: bool = True