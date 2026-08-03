from fastapi import (
    APIRouter,
    Depends,
    Response,
    status,
)
from sqlalchemy.orm import Session

from app.core.auth_dependencies import get_current_admin
from app.core.security import (
    AUTH_COOKIE_NAME,
    AUTH_COOKIE_SECURE,
    JWT_EXPIRE_MINUTES,
    create_access_token,
)
from app.database.connection import get_db
from app.models.admin import Admin
from app.schemas.auth import (
    AdminLoginRequest,
    AdminProfileUpdate,
    AdminRegisterRequest,
    AdminResponse,
)
from app.services import auth_service


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


def set_auth_cookie(
    response: Response,
    access_token: str,
) -> None:
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=access_token,
        max_age=JWT_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


@router.post(
    "/register",
    response_model=AdminResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_admin(
    registration: AdminRegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    admin = auth_service.register_admin(
        db=db,
        registration=registration,
    )

    access_token = create_access_token(
        admin_id=admin.id,
        email=admin.email,
        role=admin.role,
    )

    set_auth_cookie(
        response=response,
        access_token=access_token,
    )

    return admin


@router.post(
    "/login",
    response_model=AdminResponse,
)
def login_admin(
    login_data: AdminLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    admin = auth_service.authenticate_admin(
        db=db,
        email=str(login_data.email),
        password=login_data.password,
    )

    access_token = create_access_token(
        admin_id=admin.id,
        email=admin.email,
        role=admin.role,
    )

    set_auth_cookie(
        response=response,
        access_token=access_token,
    )

    return admin


@router.get(
    "/me",
    response_model=AdminResponse,
)
def get_authenticated_admin(
    current_admin: Admin = Depends(get_current_admin),
):
    return current_admin


@router.patch(
    "/me",
    response_model=AdminResponse,
)
def update_authenticated_admin(
    profile_update: AdminProfileUpdate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
):
    return auth_service.update_admin_profile(
        db=db,
        admin=current_admin,
        profile_update=profile_update,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
)
def logout_admin():
    response = Response(
        status_code=status.HTTP_204_NO_CONTENT
    )

    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite="lax",
    )

    return response