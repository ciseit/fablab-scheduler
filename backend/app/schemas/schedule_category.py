from pydantic import BaseModel, ConfigDict, Field


HEX_COLOR_PATTERN = r"^#[0-9A-Fa-f]{6}$"


class ScheduleCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = Field(pattern=HEX_COLOR_PATTERN)


class ScheduleCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = Field(default=None, pattern=HEX_COLOR_PATTERN)
    is_active: bool | None = None


class ScheduleCategoryResponse(BaseModel):
    id: int
    name: str
    color: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)
