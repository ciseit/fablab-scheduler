"""
Focused tests for technician CRUD: the deletion guard against orphaning
assignments/availability, and the assignment_type field round-trip.

Run with:
    cd backend && python3 -m unittest tests.test_technicians -v
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


class TechnicianDeletionTestCase(unittest.TestCase):
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

    def create_technician(self, name, email, **extra):
        payload = {
            "name": name,
            "email": email,
            "designation": "Lab Technician",
            "status": "active",
        }
        payload.update(extra)

        response = self.client.post("/technicians/", json=payload)
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

    def submit_availability(
        self,
        technician_id,
        campaign_id,
        day_of_week,
        start_time,
        end_time,
        availability_type,
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
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def create_schedule(self, campaign_id, minimum_weekly_hours=15):
        response = self.client.post(
            "/schedules/",
            json={
                "name": "Fall Schedule",
                "minimum_weekly_hours": minimum_weekly_hours,
                "campaign_id": campaign_id,
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def create_shift(
        self,
        schedule_id,
        day_of_week,
        start_time,
        end_time,
        required_technicians=1,
    ):
        response = self.client.post(
            "/shifts/",
            json={
                "schedule_id": schedule_id,
                "day_of_week": day_of_week,
                "start_time": start_time,
                "end_time": end_time,
                "required_technicians": required_technicians,
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    # -- tests --------------------------------------------------------

    def test_delete_technician_without_dependencies_succeeds(self):
        tech = self.create_technician("No Deps", "nodeps@example.com")

        response = self.client.delete(f"/technicians/{tech['id']}")
        self.assertEqual(response.status_code, 204)

        get_response = self.client.get(f"/technicians/{tech['id']}")
        self.assertEqual(get_response.status_code, 404)

    def test_delete_technician_with_availability_is_blocked(self):
        campaign = self.create_campaign()
        tech = self.create_technician(
            "Has Availability", "hasavail@example.com"
        )

        self.submit_availability(
            tech["id"], campaign["id"], "monday", "08:00", "12:00", "available"
        )

        response = self.client.delete(f"/technicians/{tech['id']}")
        self.assertEqual(response.status_code, 409)

        # The technician must still exist afterward.
        get_response = self.client.get(f"/technicians/{tech['id']}")
        self.assertEqual(get_response.status_code, 200)

    def test_delete_technician_with_assignment_is_blocked(self):
        campaign = self.create_campaign()
        campaign_id = campaign["id"]
        sched = self.create_schedule(campaign_id)
        schedule_id = sched["id"]

        tech = self.create_technician(
            "Has Assignment", "hasassignment@example.com"
        )
        self.submit_availability(
            tech["id"], campaign_id, "monday", "08:00", "12:00", "available"
        )
        self.create_shift(schedule_id, "monday", "08:00", "12:00")

        generated = self.client.post(
            f"/schedules/generate/{schedule_id}"
        )
        self.assertEqual(len(generated.json()["assignments"]), 1)

        response = self.client.delete(f"/technicians/{tech['id']}")
        self.assertEqual(response.status_code, 409)

        # No orphaned assignment: the schedule must still resolve the
        # technician cleanly rather than silently dropping the row.
        schedule_response = self.client.get(f"/schedules/{schedule_id}")
        self.assertEqual(len(schedule_response.json()["assignments"]), 1)

    def test_technician_assignment_type_round_trips(self):
        created = self.create_technician(
            "Assignment Type Tech",
            "assigntype@example.com",
            assignment_type="Lab",
            notes="Laser Lab",
        )
        self.assertEqual(created["assignment_type"], "Lab")

        update_response = self.client.patch(
            f"/technicians/{created['id']}",
            json={"assignment_type": "School Site"},
        )
        self.assertEqual(update_response.status_code, 200, update_response.text)
        self.assertEqual(
            update_response.json()["assignment_type"], "School Site"
        )

        get_response = self.client.get(f"/technicians/{created['id']}")
        self.assertEqual(
            get_response.json()["assignment_type"], "School Site"
        )

    def test_technician_assignment_name_is_distinct_from_notes(self):
        # assignment_type is a category (e.g. "School Site") while
        # assignment_name is the specific site/project (e.g. "Carson High
        # School"), and neither should be conflated with free-text notes.
        created = self.create_technician(
            "Assignment Name Tech",
            "assignname@example.com",
            assignment_type="School Site",
            assignment_name="Carson High School",
            notes="Prefers morning shifts",
        )
        self.assertEqual(created["assignment_name"], "Carson High School")
        self.assertEqual(created["notes"], "Prefers morning shifts")

        update_response = self.client.patch(
            f"/technicians/{created['id']}",
            json={"assignment_name": "Robotics Workshop"},
        )
        self.assertEqual(update_response.status_code, 200, update_response.text)
        self.assertEqual(
            update_response.json()["assignment_name"], "Robotics Workshop"
        )
        # Updating assignment_name must not touch notes.
        self.assertEqual(
            update_response.json()["notes"], "Prefers morning shifts"
        )

        get_response = self.client.get(f"/technicians/{created['id']}")
        self.assertEqual(
            get_response.json()["assignment_name"], "Robotics Workshop"
        )


if __name__ == "__main__":
    unittest.main()
