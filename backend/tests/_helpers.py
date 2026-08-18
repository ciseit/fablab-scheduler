"""
Shared fixtures for the Phase 1 usability/audit test suite added on
feature/diana-usability-schedule-v2. Not a test module itself (no
Test*/test_* classes) -- imported by the new test_*.py files so they don't
each re-duplicate the engine/TestClient boilerplate already established in
tests/test_technicians.py, tests/test_scheduling.py, etc.

Two base classes:

- ApiTestCase: overrides get_current_admin with a FakeAdmin, matching the
  existing test files' pattern. Use for anything that isn't specifically
  exercising the login/cookie/session flow itself.
- RealAuthApiTestCase: does NOT override get_current_admin, so requests
  really go through the JWT-cookie auth dependency. Use for tests/test_auth.py.
"""

import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.auth_dependencies import get_current_admin
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


class FakeAdmin:
    id = 1
    email = "admin@csudh.edu"
    role = "admin"


def _override_get_current_admin():
    return FakeAdmin()


class _EngineTestCase(unittest.TestCase):
    """Sets up a fresh in-memory SQLite engine + TestClient per test."""

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

        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=self.engine)
        self.engine.dispose()


class ApiTestCase(_EngineTestCase):
    """Auth bypassed via FakeAdmin override, like the pre-existing suites."""

    def setUp(self):
        super().setUp()
        app.dependency_overrides[get_current_admin] = _override_get_current_admin

    # -- shared fixture helpers -------------------------------------------

    def create_technician(
        self,
        name,
        email,
        status="active",
        weekly_target_hours=None,
        assignment_type=None,
        assignment_name=None,
        notes=None,
        expect_status=201,
    ):
        payload = {
            "name": name,
            "email": email,
            "designation": "Lab Technician",
            "status": status,
        }
        if weekly_target_hours is not None:
            payload["weekly_target_hours"] = weekly_target_hours
        if assignment_type is not None:
            payload["assignment_type"] = assignment_type
        if assignment_name is not None:
            payload["assignment_name"] = assignment_name
        if notes is not None:
            payload["notes"] = notes

        response = self.client.post("/technicians/", json=payload)
        self.assertEqual(response.status_code, expect_status, response.text)
        return response.json() if expect_status < 300 else response

    def create_campaign(
        self,
        name="Fall Availability",
        semester="Fall 2026",
        opens_at="2026-08-01T00:00:00",
        closes_at="2026-08-31T00:00:00",
        minimum_weekly_hours=15,
        expect_status=201,
    ):
        response = self.client.post(
            "/collection-campaigns/",
            json={
                "name": name,
                "semester": semester,
                "opens_at": opens_at,
                "closes_at": closes_at,
                "minimum_weekly_hours": minimum_weekly_hours,
            },
        )
        self.assertEqual(response.status_code, expect_status, response.text)
        return response.json() if expect_status < 300 else response

    def create_schedule(
        self,
        campaign_id=None,
        name="Fall Schedule",
        minimum_weekly_hours=15,
        expect_status=201,
        **extra,
    ):
        payload = {
            "name": name,
            "minimum_weekly_hours": minimum_weekly_hours,
            **extra,
        }
        if campaign_id is not None:
            payload["campaign_id"] = campaign_id

        response = self.client.post("/schedules/", json=payload)
        self.assertEqual(response.status_code, expect_status, response.text)
        return response.json() if expect_status < 300 else response

    def create_shift(
        self,
        schedule_id,
        day_of_week,
        start_time,
        end_time,
        required_technicians=1,
        location_id=None,
        expect_status=201,
    ):
        payload = {
            "schedule_id": schedule_id,
            "day_of_week": day_of_week,
            "start_time": start_time,
            "end_time": end_time,
            "required_technicians": required_technicians,
        }
        if location_id is not None:
            payload["location_id"] = location_id

        response = self.client.post("/shifts/", json=payload)
        self.assertEqual(response.status_code, expect_status, response.text)
        return response.json() if expect_status < 300 else response

    def create_location(self, name="FABLAB", expect_status=201):
        response = self.client.post("/locations/", json={"name": name})
        self.assertEqual(response.status_code, expect_status, response.text)
        return response.json() if expect_status < 300 else response

    def create_category(self, name="Working", color="#16a34a", expect_status=201):
        response = self.client.post(
            "/schedule-categories/", json={"name": name, "color": color}
        )
        self.assertEqual(response.status_code, expect_status, response.text)
        return response.json() if expect_status < 300 else response

    def submit_availability(
        self,
        technician_id,
        campaign_id,
        day_of_week,
        start_time,
        end_time,
        availability_type,
        expect_status=200,
    ):
        response = self.client.post(
            f"/availability/technicians/{technician_id}",
            json={
                "campaign_id": campaign_id,
                "day_of_week": day_of_week,
                "start_time": start_time,
                "end_time": end_time,
                "availability_type": availability_type,
            },
        )
        self.assertEqual(response.status_code, expect_status, response.text)
        return response.json() if expect_status < 300 else response

    def submit_public_availability(
        self, token, email, blocks, replace_existing=None, expect_status=201
    ):
        payload = {"email": email, "availability_blocks": blocks}
        if replace_existing is not None:
            payload["replace_existing"] = replace_existing

        response = self.client.post(
            f"/availability/public/{token}", json=payload
        )
        self.assertEqual(response.status_code, expect_status, response.text)
        return response.json() if expect_status < 300 else response


class RealAuthApiTestCase(_EngineTestCase):
    """No get_current_admin override -- exercises the real cookie/JWT flow."""

    pass
