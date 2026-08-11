"""
Backend-foundation tests for the scheduling MVP: Shift/Assignment models,
schemas, scheduling_service, and the /shifts and /schedules routers.

Run with:
    cd backend && python3 -m unittest tests.test_scheduling -v
"""

import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.auth_dependencies import get_current_admin
from app.database.connection import Base, get_db
from app.main import app

# Import every model module so their tables register on Base.metadata.
from app.models import admin  # noqa: F401
from app.models import assignment  # noqa: F401
from app.models import availability  # noqa: F401
from app.models import collection_campaign  # noqa: F401
from app.models import shift  # noqa: F401
from app.models import technician  # noqa: F401


class FakeAdmin:
    id = 1
    email = "admin@csudh.edu"
    role = "admin"


def _override_get_current_admin():
    return FakeAdmin()


class SchedulingTestCase(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        Base.metadata.create_all(bind=self.engine)

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

    def create_technician(self, name, email, status="active"):
        response = self.client.post(
            "/technicians/",
            json={
                "name": name,
                "email": email,
                "designation": "Lab Technician",
                "status": status,
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

    def create_shift(
        self,
        campaign_id,
        day_of_week,
        start_time,
        end_time,
        required_technicians=1,
    ):
        response = self.client.post(
            "/shifts/",
            json={
                "campaign_id": campaign_id,
                "day_of_week": day_of_week,
                "start_time": start_time,
                "end_time": end_time,
                "required_technicians": required_technicians,
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    # -- tests --------------------------------------------------------

    def test_shift_validation_rejects_bad_time_range(self):
        campaign = self.create_campaign()

        response = self.client.post(
            "/shifts/",
            json={
                "campaign_id": campaign["id"],
                "day_of_week": "monday",
                "start_time": "16:00:00",
                "end_time": "08:00:00",
                "required_technicians": 1,
            },
        )

        self.assertEqual(response.status_code, 422)

    def test_shift_endpoints_require_admin(self):
        app.dependency_overrides.pop(get_current_admin, None)

        response = self.client.get("/shifts/?campaign_id=1")

        self.assertEqual(response.status_code, 401)

        app.dependency_overrides[get_current_admin] = (
            _override_get_current_admin
        )

    def test_generate_schedule_full_scenario(self):
        campaign = self.create_campaign()
        campaign_id = campaign["id"]

        tech_a = self.create_technician("Ava Preferred", "ava@example.com")
        tech_b = self.create_technician("Ben Available", "ben@example.com")
        tech_c = self.create_technician("Cam Backup", "cam@example.com")
        tech_d = self.create_technician("Dee NoAvailability", "dee@example.com")
        tech_f = self.create_technician("Fox Restricted", "fox@example.com")

        # Ava prefers all of Monday; Ben is merely available all of Monday.
        self.submit_availability(
            tech_a["id"], campaign_id, "monday", "08:00", "16:00", "preferred"
        )
        self.submit_availability(
            tech_b["id"], campaign_id, "monday", "08:00", "16:00", "available"
        )
        # Cam only submitted a backup block for the 9-12 window.
        self.submit_availability(
            tech_c["id"], campaign_id, "monday", "09:00", "12:00", "backup"
        )
        # Fox is only "available" on paper, but it's marked restricted and
        # must never be used.
        self.submit_availability(
            tech_f["id"], campaign_id, "monday", "08:00", "16:00", "restricted"
        )
        # Dee never submits availability at all.

        # Two identical 8-hour Monday shifts: Ava (preferred) should win the
        # first, Ben (available) the second, since Ava/Fox aren't available
        # twice at an overlapping time and Fox is excluded outright.
        shift_1 = self.create_shift(campaign_id, "monday", "08:00", "16:00")
        shift_2 = self.create_shift(campaign_id, "monday", "08:00", "16:00")

        # A 3-hour Monday shift inside Cam's backup-only window; Ava/Ben are
        # already busy for that window, so this must fall back to backup.
        shift_3 = self.create_shift(campaign_id, "monday", "09:00", "12:00")

        # A Tuesday shift nobody submitted availability for -> uncovered.
        shift_4 = self.create_shift(
            campaign_id, "tuesday", "08:00", "10:00", required_technicians=2
        )

        response = self.client.post(f"/schedules/generate/{campaign_id}")
        self.assertEqual(response.status_code, 201, response.text)

        body = response.json()
        assignments = body["assignments"]
        self.assertEqual(len(assignments), 3)

        assignments_by_shift = {a["shift_id"]: a for a in assignments}

        self.assertEqual(
            assignments_by_shift[shift_1["id"]]["technician_id"], tech_a["id"]
        )
        self.assertEqual(
            assignments_by_shift[shift_2["id"]]["technician_id"], tech_b["id"]
        )
        self.assertEqual(
            assignments_by_shift[shift_3["id"]]["technician_id"], tech_c["id"]
        )

        # Fox (restricted-only) must never appear in any assignment.
        assigned_technician_ids = {
            a["technician_id"] for a in assignments
        }
        self.assertNotIn(tech_f["id"], assigned_technician_ids)

        # No technician should hold two overlapping assignments.
        by_technician = {}
        for a in assignments:
            by_technician.setdefault(a["technician_id"], []).append(
                a["shift_id"]
            )
        self.assertEqual(
            len(by_technician.get(tech_a["id"], [])), 1
        )
        self.assertEqual(
            len(by_technician.get(tech_b["id"], [])), 1
        )

        below_minimum = {
            item["technician_id"]: item
            for item in body["technicians_below_minimum"]
        }

        # Everyone is below the 15h floor in this small fixture.
        self.assertAlmostEqual(
            below_minimum[tech_a["id"]]["assigned_hours"], 8.0
        )
        self.assertAlmostEqual(
            below_minimum[tech_b["id"]]["assigned_hours"], 8.0
        )
        self.assertAlmostEqual(
            below_minimum[tech_c["id"]]["assigned_hours"], 3.0
        )
        self.assertAlmostEqual(
            below_minimum[tech_d["id"]]["assigned_hours"], 0.0
        )
        self.assertAlmostEqual(
            below_minimum[tech_f["id"]]["assigned_hours"], 0.0
        )

        uncovered = body["uncovered_shifts"]
        self.assertEqual(len(uncovered), 1)
        self.assertEqual(uncovered[0]["shift_id"], shift_4["id"])
        self.assertEqual(uncovered[0]["assigned_technicians"], 0)
        self.assertEqual(uncovered[0]["shortfall"], 2)

        # GET should reflect the same persisted state.
        get_response = self.client.get(f"/schedules/{campaign_id}")
        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(
            len(get_response.json()["assignments"]), 3
        )

    def test_generate_is_idempotent_and_regenerates(self):
        campaign = self.create_campaign()
        campaign_id = campaign["id"]

        tech = self.create_technician("Solo Tech", "solo@example.com")
        self.submit_availability(
            tech["id"], campaign_id, "monday", "08:00", "12:00", "available"
        )
        self.create_shift(campaign_id, "monday", "08:00", "12:00")

        first = self.client.post(f"/schedules/generate/{campaign_id}")
        second = self.client.post(f"/schedules/generate/{campaign_id}")

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        # Regenerating should not duplicate assignments.
        self.assertEqual(len(second.json()["assignments"]), 1)

    def test_edit_assignment_rejects_technician_without_availability(self):
        campaign = self.create_campaign()
        campaign_id = campaign["id"]

        tech_a = self.create_technician("Ava", "ava2@example.com")
        tech_d = self.create_technician("Dee", "dee2@example.com")

        self.submit_availability(
            tech_a["id"], campaign_id, "monday", "08:00", "12:00", "available"
        )
        self.create_shift(campaign_id, "monday", "08:00", "12:00")

        generated = self.client.post(f"/schedules/generate/{campaign_id}")
        assignment_id = generated.json()["assignments"][0]["id"]

        response = self.client.patch(
            f"/schedules/assignments/{assignment_id}",
            json={"technician_id": tech_d["id"]},
        )

        self.assertEqual(response.status_code, 422)

    def test_edit_assignment_rejects_overlap(self):
        campaign = self.create_campaign()
        campaign_id = campaign["id"]

        tech_a = self.create_technician("Ava", "ava3@example.com")
        tech_b = self.create_technician("Ben", "ben3@example.com")

        self.submit_availability(
            tech_a["id"], campaign_id, "monday", "08:00", "16:00", "available"
        )
        self.submit_availability(
            tech_b["id"], campaign_id, "monday", "08:00", "16:00", "available"
        )

        shift_1 = self.create_shift(campaign_id, "monday", "08:00", "16:00")
        shift_2 = self.create_shift(campaign_id, "monday", "09:00", "11:00")

        generated = self.client.post(
            f"/schedules/generate/{campaign_id}"
        ).json()

        assignments_by_shift = {
            a["shift_id"]: a for a in generated["assignments"]
        }

        # Both shifts got filled (Ava on shift_1, Ben on shift_2) since the
        # greedy pass avoids overlap during generation.
        shift_2_assignment = assignments_by_shift[shift_2["id"]]

        # Reassigning shift_2 to whoever holds shift_1 must be rejected as
        # an overlap, since shift_2's window sits inside shift_1's window.
        shift_1_assignment_technician_id = assignments_by_shift[
            shift_1["id"]
        ]["technician_id"]

        response = self.client.patch(
            f"/schedules/assignments/{shift_2_assignment['id']}",
            json={"technician_id": shift_1_assignment_technician_id},
        )

        self.assertEqual(response.status_code, 409)

    def test_edit_assignment_success(self):
        campaign = self.create_campaign()
        campaign_id = campaign["id"]

        tech_a = self.create_technician("Ava", "ava4@example.com")
        tech_b = self.create_technician("Ben", "ben4@example.com")

        self.submit_availability(
            tech_a["id"], campaign_id, "monday", "08:00", "12:00", "available"
        )
        self.submit_availability(
            tech_b["id"], campaign_id, "monday", "08:00", "12:00", "available"
        )

        self.create_shift(campaign_id, "monday", "08:00", "12:00")

        generated = self.client.post(
            f"/schedules/generate/{campaign_id}"
        ).json()
        assignment = generated["assignments"][0]

        other_technician_id = (
            tech_b["id"]
            if assignment["technician_id"] == tech_a["id"]
            else tech_a["id"]
        )

        response = self.client.patch(
            f"/schedules/assignments/{assignment['id']}",
            json={"technician_id": other_technician_id},
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            response.json()["technician_id"], other_technician_id
        )

    def test_generate_missing_campaign_returns_404(self):
        response = self.client.post("/schedules/generate/9999")
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
