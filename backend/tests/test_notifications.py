"""
Tests for the notification system: reactive events (submission,
duplicate submission) and state-based notifications (uncovered shifts,
technicians below minimum hours), plus read/unread handling.

Run with:
    cd backend && python3 -m unittest tests.test_notifications -v
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


class NotificationTestCase(unittest.TestCase):
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

    def create_schedule(self, campaign_id=None, minimum_weekly_hours=15):
        payload = {
            "name": "Fall Schedule",
            "minimum_weekly_hours": minimum_weekly_hours,
        }
        if campaign_id is not None:
            payload["campaign_id"] = campaign_id

        response = self.client.post("/schedules/", json=payload)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def create_shift(self, schedule_id, required_technicians=1):
        response = self.client.post(
            "/shifts/",
            json={
                "schedule_id": schedule_id,
                "day_of_week": "monday",
                "start_time": "09:00:00",
                "end_time": "12:00:00",
                "required_technicians": required_technicians,
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def submit_public_availability(self, token, email, blocks):
        return self.client.post(
            f"/availability/public/{token}",
            json={"email": email, "availability_blocks": blocks},
        )

    def get_notifications(self):
        response = self.client.get("/notifications/")
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    # -- tests --------------------------------------------------------

    def test_notifications_require_admin(self):
        app.dependency_overrides.pop(get_current_admin, None)

        response = self.client.get("/notifications/")
        self.assertIn(response.status_code, (401, 403))

    def test_availability_submission_creates_notification(self):
        campaign = self.create_campaign()
        self.create_technician("Ava", "ava-notify@example.com")

        response = self.submit_public_availability(
            campaign["public_token"],
            "ava-notify@example.com",
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

        data = self.get_notifications()
        types = [n["type"] for n in data["notifications"]]
        self.assertIn("availability_submitted", types)
        self.assertGreaterEqual(data["unread_count"], 1)

    def test_duplicate_submission_creates_notification_without_duplicating(
        self,
    ):
        campaign = self.create_campaign()
        self.create_technician("Ava", "ava-dup@example.com")

        block = {
            "day_of_week": "monday",
            "start_time": "09:00:00",
            "end_time": "12:00:00",
            "availability_type": "available",
        }

        self.submit_public_availability(
            campaign["public_token"], "ava-dup@example.com", [block]
        )

        # Attempt the same submission twice more; the notification must
        # not multiply.
        self.submit_public_availability(
            campaign["public_token"], "ava-dup@example.com", [block]
        )
        self.submit_public_availability(
            campaign["public_token"], "ava-dup@example.com", [block]
        )

        data = self.get_notifications()
        duplicate_notifications = [
            n
            for n in data["notifications"]
            if n["type"] == "duplicate_submission"
        ]
        self.assertEqual(len(duplicate_notifications), 1)

    def test_uncovered_shift_notification_appears_and_clears(self):
        sched = self.create_schedule()
        self.create_shift(sched["id"], required_technicians=1)

        data = self.get_notifications()
        types = [n["type"] for n in data["notifications"]]
        self.assertIn("uncovered_shifts", types)

        tech = self.create_technician(
            "Fills Shift", "fillsshift@example.com"
        )
        shift = self.client.post(
            "/shifts/",
            json={
                "schedule_id": sched["id"],
                "day_of_week": "tuesday",
                "start_time": "09:00:00",
                "end_time": "12:00:00",
                "required_technicians": 1,
            },
        ).json()

        # Cover the original shift and the new one manually.
        original_shift_id = self.client.get(
            f"/shifts/?schedule_id={sched['id']}"
        ).json()[0]["id"]

        self.client.post(
            f"/schedules/{sched['id']}/assignments",
            json={
                "shift_id": original_shift_id,
                "technician_id": tech["id"],
            },
        )
        self.client.post(
            f"/schedules/{sched['id']}/assignments",
            json={"shift_id": shift["id"], "technician_id": tech["id"]},
        )

        data_after = self.get_notifications()
        types_after = [n["type"] for n in data_after["notifications"]]
        self.assertNotIn("uncovered_shifts", types_after)

    def test_mark_notification_read_and_read_all(self):
        campaign = self.create_campaign()
        self.create_technician("Ava", "ava-read@example.com")

        self.submit_public_availability(
            campaign["public_token"],
            "ava-read@example.com",
            [
                {
                    "day_of_week": "monday",
                    "start_time": "09:00:00",
                    "end_time": "12:00:00",
                    "availability_type": "available",
                }
            ],
        )

        data = self.get_notifications()
        notification_id = data["notifications"][0]["id"]

        read_response = self.client.post(
            f"/notifications/{notification_id}/read"
        )
        self.assertEqual(read_response.status_code, 200, read_response.text)
        self.assertTrue(read_response.json()["is_read"])

        read_all_response = self.client.post("/notifications/read-all")
        self.assertEqual(read_all_response.status_code, 204)

        data_after = self.get_notifications()
        self.assertEqual(data_after["unread_count"], 0)


if __name__ == "__main__":
    unittest.main()
