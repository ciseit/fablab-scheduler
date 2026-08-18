"""
Boundary tests for the Availability Request opens_at/closes_at window.

Covers the bug where a request with a future closing time appeared
already closed: the backend treats naive stored datetimes as UTC
(see `CollectionCampaign.is_accepting_submissions`/`has_opened`), so
every caller -- including the frontend -- must convert local wall-clock
values to UTC digits before they are ever sent. These tests exercise
the backend side of that contract directly with UTC instants; the
frontend's local<->UTC conversion (`frontend/lib/datetimeUtils.ts`) is
what the admin form and public form use to always land here correctly
regardless of the visitor's timezone.

Run with:
    cd backend && python3 -m unittest tests.test_campaign_timezone -v
"""

import unittest
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.auth_dependencies import get_current_admin
from app.database.connection import Base, get_db, run_startup_migrations
from app.main import app

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


def _naive_utc_digits(dt: datetime) -> str:
    """
    What the fixed frontend now sends: a UTC instant, stripped down to
    naive "YYYY-MM-DDTHH:MM:SS" digits (see
    `localInputValueToUtcIso` in datetimeUtils.ts).
    """
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")


class CampaignTimezoneBoundaryTestCase(unittest.TestCase):
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
        app.dependency_overrides[get_current_admin] = (
            _override_get_current_admin
        )

        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=self.engine)
        self.engine.dispose()

    def create_technician(self, name="Tech", email="tech@example.com"):
        response = self.client.post(
            "/technicians/",
            json={
                "name": name,
                "email": email,
                "designation": "Lab Technician",
                "status": "active",
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def create_campaign(self, opens_at: datetime, closes_at: datetime):
        response = self.client.post(
            "/collection-campaigns/",
            json={
                "name": "Boundary Test Request",
                "semester": "Test",
                "opens_at": _naive_utc_digits(opens_at),
                "closes_at": _naive_utc_digits(closes_at),
                "minimum_weekly_hours": 15,
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def submit(self, token, email="tech@example.com"):
        return self.client.post(
            f"/availability/public/{token}",
            json={
                "email": email,
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

    # -- opens_at boundary --------------------------------------------

    def test_before_opens_at_blocks_submission(self):
        now = datetime.now(timezone.utc)
        campaign = self.create_campaign(
            opens_at=now + timedelta(hours=2),
            closes_at=now + timedelta(days=7),
        )

        self.assertFalse(campaign["has_opened"])
        self.assertFalse(campaign["is_accepting_submissions"])

        self.create_technician()
        response = self.submit(campaign["public_token"])

        self.assertEqual(response.status_code, 409, response.text)
        self.assertIn("not open yet", response.json()["detail"])

    def test_at_opens_at_boundary_is_open(self):
        now = datetime.now(timezone.utc)
        # opens_at a moment in the past so "now" is past the boundary
        # by the time the request reaches the server.
        campaign = self.create_campaign(
            opens_at=now - timedelta(seconds=1),
            closes_at=now + timedelta(days=7),
        )

        self.assertTrue(campaign["has_opened"])
        self.assertTrue(campaign["is_accepting_submissions"])

    def test_between_opens_and_closes_accepts_submission(self):
        now = datetime.now(timezone.utc)
        campaign = self.create_campaign(
            opens_at=now - timedelta(days=1),
            closes_at=now + timedelta(days=7),
        )

        self.create_technician()
        response = self.submit(campaign["public_token"])

        self.assertEqual(response.status_code, 201, response.text)

    # -- closes_at boundary ---------------------------------------------

    def test_one_hour_before_closes_at_is_open(self):
        now = datetime.now(timezone.utc)
        campaign = self.create_campaign(
            opens_at=now - timedelta(days=1),
            closes_at=now + timedelta(hours=1),
        )

        self.assertTrue(campaign["is_accepting_submissions"])

    def test_just_before_closes_at_is_open(self):
        now = datetime.now(timezone.utc)
        campaign = self.create_campaign(
            opens_at=now - timedelta(days=1),
            closes_at=now + timedelta(seconds=2),
        )

        self.assertTrue(campaign["is_accepting_submissions"])

    def test_immediately_after_closes_at_blocks_submission(self):
        now = datetime.now(timezone.utc)
        campaign = self.create_campaign(
            opens_at=now - timedelta(days=2),
            closes_at=now - timedelta(seconds=1),
        )

        self.assertFalse(campaign["is_accepting_submissions"])

        self.create_technician()
        response = self.submit(campaign["public_token"])

        self.assertEqual(response.status_code, 409, response.text)
        self.assertIn("closed", response.json()["detail"])
        self.assertNotIn("not open yet", response.json()["detail"])

    # -- displayed deadline == enforced deadline -----------------------

    def test_returned_closes_at_round_trips_the_same_instant(self):
        """
        The API must hand back the exact instant it was given (no
        server-side reinterpretation), so the frontend's UTC-aware
        display always matches what the backend enforces.
        """
        now = datetime.now(timezone.utc)
        closes_at = now + timedelta(days=3, hours=4, minutes=15)

        campaign = self.create_campaign(
            opens_at=now - timedelta(days=1),
            closes_at=closes_at,
        )

        returned = datetime.fromisoformat(
            campaign["closes_at"]
        ).replace(tzinfo=timezone.utc)

        self.assertEqual(
            returned.replace(microsecond=0),
            closes_at.replace(microsecond=0),
        )

    # -- Pacific/local browser + DST cases -------------------------------

    def test_pacific_local_close_time_before_dst_spring_forward(self):
        """
        A Diana-in-Los-Angeles scenario: she means "closes 11:59 PM
        Pacific" on a date just before the U.S. spring-forward DST
        transition. The frontend converts that local wall time to UTC
        before sending it (what `_naive_utc_digits` simulates here);
        the backend must honor that exact UTC instant.
        """
        pacific = ZoneInfo("America/Los_Angeles")
        # 2026-03-07 is a Saturday before the 2026-03-08 U.S. DST
        # transition -- still standard time (UTC-8).
        local_close = datetime(2026, 3, 7, 23, 59, tzinfo=pacific)

        campaign = self.create_campaign(
            opens_at=local_close - timedelta(days=1),
            closes_at=local_close,
        )

        # 23:59 PST == 07:59 UTC the next day.
        self.assertEqual(campaign["closes_at"], "2026-03-08T07:59:00")

    def test_pacific_local_close_time_after_dst_spring_forward(self):
        pacific = ZoneInfo("America/Los_Angeles")
        # 2026-03-09 is after the transition -- daylight time (UTC-7).
        local_close = datetime(2026, 3, 9, 23, 59, tzinfo=pacific)

        campaign = self.create_campaign(
            opens_at=local_close - timedelta(days=1),
            closes_at=local_close,
        )

        # 23:59 PDT == 06:59 UTC the next day (one hour earlier in UTC
        # than the pre-DST case above, for the same local wall clock).
        self.assertEqual(campaign["closes_at"], "2026-03-10T06:59:00")

    def test_utc_conversion_matches_naive_storage_contract(self):
        """
        A submitter in UTC itself (offset zero) is the simplest case:
        local wall time and stored UTC digits are identical.
        """
        utc_close = datetime(2026, 6, 15, 18, 30, tzinfo=timezone.utc)

        campaign = self.create_campaign(
            opens_at=utc_close - timedelta(days=1),
            closes_at=utc_close,
        )

        self.assertEqual(campaign["closes_at"], "2026-06-15T18:30:00")


if __name__ == "__main__":
    unittest.main()
