from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import (
    AUTH_COOKIE_NAME,
    decode_access_token,
)
from app.database.connection import get_db
from app.models.admin import Admin
from app.services import auth_service


def get_current_admin(
    request: Request,
    db: Session = Depends(get_db),
) -> Admin:
    access_token = request.cookies.get(
        AUTH_COOKIE_NAME
    )

    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    payload = decode_access_token(access_token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Invalid or expired authentication session"
            ),
        )

    admin_id = payload.get("sub")

    try:
        parsed_admin_id = int(admin_id)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication session",
        )

    admin = auth_service.get_admin_by_id(
        db=db,
        admin_id=parsed_admin_id,
    )

    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Administrator account not found",
        )

    return admin