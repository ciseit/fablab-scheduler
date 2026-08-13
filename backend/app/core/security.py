import os
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from dotenv import load_dotenv
from jwt import InvalidTokenError
from pwdlib import PasswordHash


load_dotenv()


password_hash = PasswordHash.recommended()


JWT_SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY",
    "development-only-secret-change-this",
)

JWT_ALGORITHM = os.getenv(
    "JWT_ALGORITHM",
    "HS256",
)

JWT_EXPIRE_MINUTES = int(
    os.getenv(
        "JWT_EXPIRE_MINUTES",
        "480",
    )
)

AUTH_COOKIE_NAME = os.getenv(
    "AUTH_COOKIE_NAME",
    "fablab_admin_session",
)

AUTH_COOKIE_SECURE = (
    os.getenv(
        "AUTH_COOKIE_SECURE",
        "false",
    ).strip().lower()
    == "true"
)


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(
    plain_password: str,
    stored_password_hash: str,
) -> bool:
    return password_hash.verify(
        plain_password,
        stored_password_hash,
    )


def create_access_token(
    admin_id: int,
    email: str,
    role: str,
) -> str:
    now = datetime.now(timezone.utc)

    payload: dict[str, Any] = {
        "sub": str(admin_id),
        "email": email,
        "role": role,
        "iat": now,
        "exp": now + timedelta(
            minutes=JWT_EXPIRE_MINUTES
        ),
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )


def decode_access_token(
    token: str,
) -> dict[str, Any] | None:
    try:
        return jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )
    except InvalidTokenError:
        return None


def get_allowed_admin_domains() -> set[str]:
    configured_domains = os.getenv(
        "ADMIN_ALLOWED_EMAIL_DOMAINS",
        "",
    )

    return {
        domain.strip().lower().lstrip("@")
        for domain in configured_domains.split(",")
        if domain.strip()
    }


def is_allowed_admin_email(email: str) -> bool:
    normalized_email = email.strip().lower()

    if "@" not in normalized_email:
        return False

    email_domain = normalized_email.rsplit("@", 1)[1]

    return email_domain in get_allowed_admin_domains()


def is_valid_admin_invite_code(
    invite_code: str,
) -> bool:
    configured_invite_code = os.getenv(
        "ADMIN_INVITE_CODE",
        "",
    )

    if not configured_invite_code:
        return False

    return invite_code == configured_invite_code