"""
Tests for Availability Request (CollectionCampaign) deletion and the
duplicate-submission handling in the public availability form.

Run with:
    cd backend && python3 -m unittest tests.test_collection_campaigns -v
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


class CollectionCampaignTestCase(unittest.TestCase):
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

    # -- fixture helpers --------------------------------------------------

    def create_technician(self, name, email):
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

    def create_campaign(self):
        response = self.client.post(
            "/collection-campaigns/",
            json={
                "name": "Fall Availability",
                "semester": "Fall 2026",
                "opens_at": "2026-08-01T00:00:00",
                "closes_at": "2026-08-31T00:00:00",
                "minimum_weekly_hours": 15,
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def create_schedule(self, campaign_id):
        response = self.client.post(
            "/schedules/",
            json={
                "name": "Fall Schedule",
                "minimum_weekly_hours": 15,
                "campaign_id": campaign_id,
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def submit_public_availability(
        self, token, email, blocks, replace_existing=None
    ):
        payload = {"email": email, "availability_blocks": blocks}

        if replace_existing is not None:
            payload["replace_existing"] = replace_existing

        return self.client.post(
            f"/availability/public/{token}",
            json=payload,
        )

    # -- deletion tests -----------------------------------------------

    def test_delete_empty_campaign_succeeds(self):
        campaign = self.create_campaign()

        response = self.client.delete(
            f"/collection-campaigns/{campaign['id']}"
        )
        self.assertEqual(response.status_code, 204, response.text)

        get_response = self.client.get("/collection-campaigns/")
        self.assertEqual(get_response.json(), [])

    def test_delete_missing_campaign_returns_404(self):
        response = self.client.delete("/collection-campaigns/999")
        self.assertEqual(response.status_code, 404)

    def test_delete_requires_admin(self):
        campaign = self.create_campaign()

        app.dependency_overrides.pop(get_current_admin, None)

        response = self.client.delete(
            f"/collection-campaigns/{campaign['id']}"
        )
        self.assertIn(response.status_code, (401, 403))

    def test_delete_blocked_with_submissions(self):
        campaign = self.create_campaign()
        tech = self.create_technician("Ava", "ava@example.com")

        response = self.submit_public_availability(
            campaign["public_token"],
            "ava@example.com",
            [
                {
                    "day_of_week": "monday",
                    "start_time": "09:00:00",
                    "end_time": "12:00:00",
                    "availability_type": "available",
                }
            ],
        )
        self.assertEqual(response.status_code, 201, response.text)

        delete_response = self.client.delete(
            f"/collection-campaigns/{campaign['id']}"
        )
        self.assertEqual(delete_response.status_code, 409)
        self.assertIn(
            "submission", delete_response.json()["detail"].lower()
        )

        # The request and the technician's submission must both survive.
        get_response = self.client.get(
            f"/collection-campaigns/{campaign['id']}/submission-summary"
        )
        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(
            get_response.json()["unique_technicians_submitted"], 1
        )

    def test_delete_blocked_with_linked_schedule(self):
        campaign = self.create_campaign()
        self.create_schedule(campaign["id"])

        delete_response = self.client.delete(
            f"/collection-campaigns/{campaign['id']}"
        )
        self.assertEqual(delete_response.status_code, 409)
        self.assertIn(
            "schedule", delete_response.json()["detail"].lower()
        )

    # -- duplicate submission tests ------------------------------------

    def test_resubmitting_identical_availability_is_rejected(self):
        campaign = self.create_campaign()
        self.create_technician("Ava", "ava@example.com")

        block = {
            "day_of_week": "monday",
            "start_time": "09:00:00",
            "end_time": "12:00:00",
            "availability_type": "available",
        }

        first = self.submit_public_availability(
            campaign["public_token"], "ava@example.com", [block]
        )
        self.assertEqual(first.status_code, 201, first.text)

        second = self.submit_public_availability(
            campaign["public_token"], "ava@example.com", [block]
        )
        self.assertEqual(second.status_code, 409)
        self.assertIn(
            "already submitted", second.json()["detail"].lower()
        )

        # The unique submitted-technician count must not double count.
        summary = self.client.get(
            f"/collection-campaigns/{campaign['id']}/submission-summary"
        )
        self.assertEqual(
            summary.json()["unique_technicians_submitted"], 1
        )
        self.assertEqual(summary.json()["total_availability_blocks"], 1)

    def test_resubmitting_different_availability_without_replace_is_rejected(
        self,
    ):
        # A technician correcting a mistake must not silently end up with
        # both the old and new availability blocks on file.
        campaign = self.create_campaign()
        self.create_technician("Ava", "ava@example.com")

        first_block = {
            "day_of_week": "monday",
            "start_time": "09:00:00",
            "end_time": "12:00:00",
            "availability_type": "available",
        }

        second_block = {
            "day_of_week": "tuesday",
            "start_time": "10:00:00",
            "end_time": "13:00:00",
            "availability_type": "preferred",
        }

        first = self.submit_public_availability(
            campaign["public_token"], "ava@example.com", [first_block]
        )
        self.assertEqual(first.status_code, 201, first.text)

        second = self.submit_public_availability(
            campaign["public_token"], "ava@example.com", [second_block]
        )
        self.assertEqual(second.status_code, 409)
        self.assertIn(
            "already submitted", second.json()["detail"].lower()
        )

        summary = self.client.get(
            f"/collection-campaigns/{campaign['id']}/submission-summary"
        )
        # Only the first submission's block should exist.
        self.assertEqual(summary.json()["total_availability_blocks"], 1)

    def test_replace_existing_submission_swaps_blocks(self):
        campaign = self.create_campaign()
        self.create_technician("Ava", "ava@example.com")

        first_block = {
            "day_of_week": "monday",
            "start_time": "09:00:00",
            "end_time": "12:00:00",
            "availability_type": "available",
        }

        replacement_blocks = [
            {
                "day_of_week": "tuesday",
                "start_time": "10:00:00",
                "end_time": "13:00:00",
                "availability_type": "preferred",
            },
            {
                "day_of_week": "wednesday",
                "start_time": "10:00:00",
                "end_time": "13:00:00",
                "availability_type": "preferred",
            },
        ]

        first = self.submit_public_availability(
            campaign["public_token"], "ava@example.com", [first_block]
        )
        self.assertEqual(first.status_code, 201, first.text)

        replaced = self.submit_public_availability(
            campaign["public_token"],
            "ava@example.com",
            replacement_blocks,
            replace_existing=True,
        )
        self.assertEqual(replaced.status_code, 201, replaced.text)
        self.assertEqual(len(replaced.json()), 2)

        summary = self.client.get(
            f"/collection-campaigns/{campaign['id']}/submission-summary"
        )
        self.assertEqual(
            summary.json()["unique_technicians_submitted"], 1
        )
        # Old block replaced, not appended: exactly the 2 new blocks.
        self.assertEqual(summary.json()["total_availability_blocks"], 2)

    # -- submission roster tests ---------------------------------------

    def test_roster_lists_submitted_and_pending_technicians_once(self):
        campaign = self.create_campaign()
        self.create_technician("Ava", "ava@example.com")
        self.create_technician("Jordan", "jordan@example.com")

        block = {
            "day_of_week": "monday",
            "start_time": "09:00:00",
            "end_time": "12:00:00",
            "availability_type": "available",
        }

        first = self.submit_public_availability(
            campaign["public_token"], "ava@example.com", [block]
        )
        self.assertEqual(first.status_code, 201, first.text)

        second_block = {
            "day_of_week": "tuesday",
            "start_time": "09:00:00",
            "end_time": "12:00:00",
            "availability_type": "available",
        }
        second = self.submit_public_availability(
            campaign["public_token"], "ava@example.com", [second_block]
        )
        # Duplicate submission attempt without replace_existing.
        self.assertEqual(second.status_code, 409)

        roster_response = self.client.get(
            f"/collection-campaigns/{campaign['id']}/roster"
        )
        self.assertEqual(roster_response.status_code, 200)
        roster = roster_response.json()

        submitted_names = [
            entry["technician_name"] for entry in roster["submitted"]
        ]
        pending_names = [
            entry["technician_name"] for entry in roster["pending"]
        ]

        # Ava must appear exactly once, in "submitted" only.
        self.assertEqual(submitted_names, ["Ava"])
        self.assertEqual(pending_names, ["Jordan"])
        self.assertIsNotNone(roster["submitted"][0]["submitted_at"])

    def test_roster_requires_admin(self):
        campaign = self.create_campaign()

        app.dependency_overrides.pop(get_current_admin, None)

        response = self.client.get(
            f"/collection-campaigns/{campaign['id']}/roster"
        )
        self.assertIn(response.status_code, (401, 403))

    def test_saturday_and_sunday_are_accepted(self):
        campaign = self.create_campaign()
        self.create_technician("Ava", "ava@example.com")

        response = self.submit_public_availability(
            campaign["public_token"],
            "ava@example.com",
            [
                {
                    "day_of_week": "saturday",
                    "start_time": "09:00:00",
                    "end_time": "12:00:00",
                    "availability_type": "available",
                },
                {
                    "day_of_week": "sunday",
                    "start_time": "09:00:00",
                    "end_time": "12:00:00",
                    "availability_type": "available",
                },
            ],
        )
        self.assertEqual(response.status_code, 201, response.text)
        days = {block["day_of_week"] for block in response.json()}
        self.assertEqual(days, {"saturday", "sunday"})


if __name__ == "__main__":
    unittest.main()
