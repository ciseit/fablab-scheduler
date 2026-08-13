from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import (
    hash_password,
    is_allowed_admin_email,
    is_valid_admin_invite_code,
    verify_password,
)
from app.models.admin import Admin
from app.schemas.auth import (
    AdminProfileUpdate,
    AdminRegisterRequest,
)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_admin_by_email(
    db: Session,
    email: str,
) -> Admin | None:
    normalized_email = normalize_email(email)

    return (
        db.query(Admin)
        .filter(func.lower(Admin.email) == normalized_email)
        .first()
    )


def get_admin_by_id(
    db: Session,
    admin_id: int,
) -> Admin | None:
    return (
        db.query(Admin)
        .filter(Admin.id == admin_id)
        .first()
    )


def register_admin(
    db: Session,
    registration: AdminRegisterRequest,
) -> Admin:
    normalized_email = normalize_email(
        str(registration.email)
    )

    if not is_allowed_admin_email(normalized_email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email domain is not approved for administrator registration",
        )

    if not is_valid_admin_invite_code(
        registration.invite_code
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid administrator invite code",
        )

    existing_admin = get_admin_by_email(
        db=db,
        email=normalized_email,
    )

    if existing_admin is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An administrator with this email already exists",
        )

    new_admin = Admin(
        full_name=registration.full_name.strip(),
        email=normalized_email,
        password_hash=hash_password(
            registration.password
        ),
        role="admin",
    )

    db.add(new_admin)

    try:
        db.commit()
        db.refresh(new_admin)
    except Exception:
        db.rollback()
        raise

    return new_admin


def authenticate_admin(
    db: Session,
    email: str,
    password: str,
) -> Admin:
    admin = get_admin_by_email(
        db=db,
        email=email,
    )

    if admin is None or not verify_password(
        password,
        admin.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return admin


def update_admin_profile(
    db: Session,
    admin: Admin,
    profile_update: AdminProfileUpdate,
) -> Admin:
    update_data = profile_update.model_dump(
        exclude_unset=True
    )

    if "email" in update_data:
        normalized_email = normalize_email(
            str(update_data["email"])
        )

        if not is_allowed_admin_email(normalized_email):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email domain is not approved for administrators",
            )

        existing_admin = get_admin_by_email(
            db=db,
            email=normalized_email,
        )

        if (
            existing_admin is not None
            and existing_admin.id != admin.id
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An administrator with this email already exists",
            )

        admin.email = normalized_email

    if "full_name" in update_data:
        admin.full_name = update_data[
            "full_name"
        ].strip()

    try:
        db.commit()
        db.refresh(admin)
    except Exception:
        db.rollback()
        raise

    return admin