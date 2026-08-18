"""
Authentication / security tests (Phase 1, Section A of the Diana
usability-v2 audit): login, logout, registration, session/cookie
handling, and protected-vs-public endpoint boundaries.

Unlike the other test modules, this one does NOT override
get_current_admin -- it exercises the real cookie/JWT flow end to
end, since that's the thing being tested here.

Run with:
    cd backend && python3 -m unittest tests.test_auth -v
"""

import os
import unittest
from datetime import datetime, timedelta, timezone

import jwt
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import AUTH_COOKIE_NAME, JWT_ALGORITHM, JWT_SECRET_KEY
from app.database.connection import Base, get_db, run_startup_migrations
from app.main import app

# Import every model module so their tables register on Base.metadata.
from app.models import admin  # noqa: F401
from app.models import assignment  # noqa: F401
from app.models import availability  # noqa: F401
from app.models import collection_campaign  # noqa: F401
from app.models import location  # noqa: F401
from app.models import notification  # noqa: F401
from app.models import schedule  # noqa: F401
from app.models import schedule_category  # noqa: F401
from app.models import shift  # noqa: F401
from app.models import technician  # noqa: F401


ALLOWED_DOMAIN = "csudh.edu"
INVITE_CODE = "phase1-test-invite"


class AuthTestCase(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        Base.metadata.create_all(bind=self.engine)
        run_startup_migrations(db_engine=self.engine)

        TestingSessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine,
        )

        def _override_get_db():
            db = TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = _override_get_db

        self._old_domains = os.environ.get("ADMIN_ALLOWED_EMAIL_DOMAINS")
        self._old_invite = os.environ.get("ADMIN_INVITE_CODE")
        os.environ["ADMIN_ALLOWED_EMAIL_DOMAINS"] = ALLOWED_DOMAIN
        os.environ["ADMIN_INVITE_CODE"] = INVITE_CODE

        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=self.engine)
        self.engine.dispose()

        if self._old_domains is None:
            os.environ.pop("ADMIN_ALLOWED_EMAIL_DOMAINS", None)
        else:
            os.environ["ADMIN_ALLOWED_EMAIL_DOMAINS"] = self._old_domains

        if self._old_invite is None:
            os.environ.pop("ADMIN_INVITE_CODE", None)
        else:
            os.environ["ADMIN_INVITE_CODE"] = self._old_invite

    # -- fixture helpers --------------------------------------------

    def register(
        self,
        full_name="Diana Admin",
        email="diana@csudh.edu",
        password="correct-horse-battery",
        confirm_password=None,
        invite_code=INVITE_CODE,
    ):
        return self.client.post(
            "/auth/register",
            json={
                "full_name": full_name,
                "email": email,
                "password": password,
                "confirm_password": (
                    confirm_password
                    if confirm_password is not None
                    else password
                ),
                "invite_code": invite_code,
            },
        )

    def login(self, email="diana@csudh.edu", password="correct-horse-battery"):
        return self.client.post(
            "/auth/login",
            json={"email": email, "password": password},
        )

    # -- registration --------------------------------------------------

    def test_register_creates_admin_and_sets_cookie(self):
        response = self.register()
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["email"], "diana@csudh.edu")
        self.assertIn(AUTH_COOKIE_NAME, response.cookies)

    def test_register_rejects_disallowed_email_domain(self):
        response = self.register(email="diana@gmail.com")
        self.assertEqual(response.status_code, 403)

    def test_register_rejects_invalid_invite_code(self):
        response = self.register(invite_code="wrong-code")
        self.assertEqual(response.status_code, 403)

    def test_register_rejects_password_mismatch(self):
        response = self.register(
            password="correct-horse-battery",
            confirm_password="different-password",
        )
        self.assertEqual(response.status_code, 422)

    def test_register_rejects_too_short_password(self):
        response = self.register(password="short1", confirm_password="short1")
        self.assertEqual(response.status_code, 422)

    def test_register_rejects_duplicate_email(self):
        first = self.register()
        self.assertEqual(first.status_code, 201, first.text)

        second = self.register()
        self.assertEqual(second.status_code, 409)

    def test_register_duplicate_email_is_case_insensitive(self):
        first = self.register(email="diana@csudh.edu")
        self.assertEqual(first.status_code, 201, first.text)

        second = self.register(email="DIANA@CSUDH.EDU")
        self.assertEqual(second.status_code, 409)

    # -- login -----------------------------------------------------------

    def test_login_valid_admin_succeeds(self):
        self.register()
        response = self.login()
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIn(AUTH_COOKIE_NAME, response.cookies)

    def test_login_invalid_password_rejected(self):
        self.register()
        response = self.login(password="totally-wrong-password")
        self.assertEqual(response.status_code, 401)

    def test_login_nonexistent_user_rejected(self):
        response = self.login(email="ghost@csudh.edu", password="whatever123")
        self.assertEqual(response.status_code, 401)

    def test_login_empty_email_rejected(self):
        response = self.client.post(
            "/auth/login", json={"email": "", "password": "whatever123"}
        )
        self.assertEqual(response.status_code, 422)

    def test_login_empty_password_rejected(self):
        self.register()
        response = self.client.post(
            "/auth/login", json={"email": "diana@csudh.edu", "password": ""}
        )
        self.assertEqual(response.status_code, 422)

    def test_login_malformed_email_rejected(self):
        response = self.client.post(
            "/auth/login",
            json={"email": "not-an-email", "password": "whatever123"},
        )
        self.assertEqual(response.status_code, 422)

    def test_login_email_is_case_insensitive(self):
        self.register(email="diana@csudh.edu")
        response = self.login(email="DIANA@csudh.edu")
        self.assertEqual(response.status_code, 200, response.text)

    def test_login_does_not_leak_whether_email_exists(self):
        # Wrong password on a real account and a nonexistent account
        # should look identical to the caller.
        self.register()
        wrong_password = self.login(password="totally-wrong-password")
        nonexistent = self.login(email="ghost@csudh.edu")

        self.assertEqual(wrong_password.status_code, nonexistent.status_code)
        self.assertEqual(
            wrong_password.json()["detail"], nonexistent.json()["detail"]
        )

    # -- session / cookie handling --------------------------------------

    def test_me_without_cookie_returns_401(self):
        response = self.client.get("/auth/me")
        self.assertEqual(response.status_code, 401)

    def test_me_with_valid_cookie_returns_200(self):
        self.register()
        response = self.client.get("/auth/me")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["email"], "diana@csudh.edu")

    def test_logout_clears_cookie_and_revokes_access(self):
        self.register()
        me_before = self.client.get("/auth/me")
        self.assertEqual(me_before.status_code, 200)

        logout_response = self.client.post("/auth/logout")
        self.assertEqual(logout_response.status_code, 204)

        me_after = self.client.get("/auth/me")
        self.assertEqual(me_after.status_code, 401)

    def test_garbage_token_in_cookie_returns_401(self):
        self.client.cookies.set(AUTH_COOKIE_NAME, "not-a-real-jwt")
        response = self.client.get("/auth/me")
        self.assertEqual(response.status_code, 401)

    def test_expired_token_returns_401(self):
        now = datetime.now(timezone.utc)
        expired_payload = {
            "sub": "1",
            "email": "diana@csudh.edu",
            "role": "admin",
            "iat": now - timedelta(hours=2),
            "exp": now - timedelta(hours=1),
        }
        expired_token = jwt.encode(
            expired_payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM
        )

        self.client.cookies.set(AUTH_COOKIE_NAME, expired_token)
        response = self.client.get("/auth/me")
        self.assertEqual(response.status_code, 401)

    def test_token_for_deleted_admin_returns_401(self):
        registered = self.register()
        admin_id = registered.json()["id"]

        now = datetime.now(timezone.utc)
        forged_payload = {
            "sub": str(admin_id + 999),
            "email": "ghost@csudh.edu",
            "role": "admin",
            "iat": now,
            "exp": now + timedelta(hours=1),
        }
        forged_token = jwt.encode(
            forged_payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM
        )

        self.client.cookies.clear()
        self.client.cookies.set(AUTH_COOKIE_NAME, forged_token)
        response = self.client.get("/auth/me")
        self.assertEqual(response.status_code, 401)

    def test_token_signed_with_wrong_secret_returns_401(self):
        now = datetime.now(timezone.utc)
        payload = {
            "sub": "1",
            "email": "diana@csudh.edu",
            "role": "admin",
            "iat": now,
            "exp": now + timedelta(hours=1),
        }
        forged_token = jwt.encode(payload, "wrong-secret", algorithm=JWT_ALGORITHM)

        self.client.cookies.set(AUTH_COOKIE_NAME, forged_token)
        response = self.client.get("/auth/me")
        self.assertEqual(response.status_code, 401)

    # -- protected vs. public endpoint boundaries ------------------------

    def test_protected_endpoint_without_auth_returns_401(self):
        response = self.client.post(
            "/technicians/",
            json={
                "name": "No Auth Tech",
                "email": "noauth@example.com",
                "designation": "Lab Technician",
            },
        )
        self.assertEqual(response.status_code, 401)

    def test_protected_endpoint_with_auth_succeeds(self):
        self.register()
        response = self.client.post(
            "/technicians/",
            json={
                "name": "Authed Tech",
                "email": "authed@example.com",
                "designation": "Lab Technician",
            },
        )
        self.assertEqual(response.status_code, 201, response.text)

    def test_public_endpoints_remain_public_without_auth(self):
        # GET /locations/ and GET /schedule-categories/ have no auth
        # dependency at all -- Diana-configured dropdown data needs to
        # be readable by the public submission/schedule pages too.
        locations_response = self.client.get("/locations/")
        self.assertEqual(locations_response.status_code, 200)

        categories_response = self.client.get("/schedule-categories/")
        self.assertEqual(categories_response.status_code, 200)

    def test_public_availability_submission_endpoint_is_public(self):
        # Wrong public_token still means "endpoint reachable without a
        # session", it should 404 (not found) rather than 401/403.
        response = self.client.post(
            "/availability/public/does-not-exist",
            json={
                "email": "someone@example.com",
                "availability_blocks": [
                    {
                        "day_of_week": "monday",
                        "start_time": "09:00:00",
                        "end_time": "12:00:00",
                        "availability_type": "available",
                    }
                ],
            },
        )
        self.assertEqual(response.status_code, 404)

    def test_public_schedule_endpoint_is_public(self):
        response = self.client.get("/schedules/public/does-not-exist")
        self.assertIn(response.status_code, (401, 403, 404))
        # Must specifically be "not found", not an auth challenge --
        # this route has no get_current_admin dependency.
        self.assertEqual(response.status_code, 404)

    def test_unauthorized_schedule_modification_is_rejected(self):
        self.register()
        schedule = self.create_standalone_schedule_authed()
        self.client.post("/auth/logout")

        response = self.client.patch(
            f"/schedules/{schedule['id']}", json={"name": "Hijacked Name"}
        )
        self.assertEqual(response.status_code, 401)

    def test_unauthorized_technician_modification_is_rejected(self):
        self.register()
        create = self.client.post(
            "/technicians/",
            json={
                "name": "Protected Tech",
                "email": "protected@example.com",
                "designation": "Lab Technician",
            },
        )
        technician_id = create.json()["id"]
        self.client.post("/auth/logout")

        response = self.client.patch(
            f"/technicians/{technician_id}", json={"name": "Hijacked"}
        )
        self.assertEqual(response.status_code, 401)

    def test_unauthorized_availability_request_modification_is_rejected(self):
        self.register()
        self.client.post("/auth/logout")

        response = self.client.post(
            "/collection-campaigns/",
            json={
                "name": "Hijacked Campaign",
                "semester": "Fall 2026",
                "opens_at": "2026-08-01T00:00:00",
                "closes_at": "2026-08-31T00:00:00",
            },
        )
        self.assertEqual(response.status_code, 401)

    def create_standalone_schedule_authed(self):
        response = self.client.post(
            "/schedules/",
            json={"name": "Auth Test Schedule", "minimum_weekly_hours": 15},
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    # -- profile update ---------------------------------------------------

    def test_profile_update_requires_at_least_one_field(self):
        self.register()
        response = self.client.patch("/auth/me", json={})
        self.assertEqual(response.status_code, 422)

    def test_profile_update_rejects_duplicate_email(self):
        self.register(email="diana@csudh.edu")
        self.client.post("/auth/logout")
        self.register(email="other@csudh.edu")

        response = self.client.patch(
            "/auth/me", json={"email": "diana@csudh.edu"}
        )
        self.assertEqual(response.status_code, 409)

    def test_profile_update_full_name_succeeds(self):
        self.register()
        response = self.client.patch(
            "/auth/me", json={"full_name": "Diana Updated"}
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["full_name"], "Diana Updated")


if __name__ == "__main__":
    unittest.main()
