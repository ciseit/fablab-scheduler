"""
Backend-foundation tests for the scheduling MVP: Schedule/Shift/Assignment
models, schemas, scheduling_service, and the /shifts and /schedules
routers.

Run with:
    cd backend && python3 -m unittest tests.test_scheduling -v
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


class SchedulingTestCase(unittest.TestCase):
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

    def create_campaign(self, minimum_weekly_hours=15):
        response = self.client.post(
            "/collection-campaigns/",
            json={
                "name": "Fall Availability",
                "semester": "Fall 2026",
                "opens_at": "2026-08-01T00:00:00",
                "closes_at": "2026-08-31T00:00:00",
                "minimum_weekly_hours": minimum_weekly_hours,
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def create_schedule_linked_to_campaign(
        self, campaign_id, minimum_weekly_hours=15
    ):
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

    def create_standalone_schedule(self, minimum_weekly_hours=15, name="Standalone Schedule"):
        response = self.client.post(
            "/schedules/",
            json={
                "name": name,
                "minimum_weekly_hours": minimum_weekly_hours,
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
        schedule_id,
        day_of_week,
        start_time,
        end_time,
        required_technicians=1,
        location_id=None,
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
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def make_campaign_and_schedule(self, minimum_weekly_hours=15):
        campaign = self.create_campaign(
            minimum_weekly_hours=minimum_weekly_hours
        )
        sched = self.create_schedule_linked_to_campaign(
            campaign["id"], minimum_weekly_hours=minimum_weekly_hours
        )
        return campaign, sched

    # -- tests --------------------------------------------------------

    def test_shift_validation_rejects_bad_time_range(self):
        _, sched = self.make_campaign_and_schedule()

        response = self.client.post(
            "/shifts/",
            json={
                "schedule_id": sched["id"],
                "day_of_week": "monday",
                "start_time": "16:00:00",
                "end_time": "08:00:00",
                "required_technicians": 1,
            },
        )

        self.assertEqual(response.status_code, 422)

    def test_shift_endpoints_require_admin(self):
        app.dependency_overrides.pop(get_current_admin, None)

        response = self.client.get("/shifts/?schedule_id=1")

        self.assertEqual(response.status_code, 401)

        app.dependency_overrides[get_current_admin] = (
            _override_get_current_admin
        )

    def test_generate_schedule_full_scenario(self):
        campaign, sched = self.make_campaign_and_schedule()
        campaign_id = campaign["id"]
        schedule_id = sched["id"]

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
        shift_1 = self.create_shift(schedule_id, "monday", "08:00", "16:00")
        shift_2 = self.create_shift(schedule_id, "monday", "08:00", "16:00")

        # A 3-hour Monday shift inside Cam's backup-only window; Ava/Ben are
        # already busy for that window, so this must fall back to backup.
        shift_3 = self.create_shift(schedule_id, "monday", "09:00", "12:00")

        # A Tuesday shift nobody submitted availability for -> uncovered.
        shift_4 = self.create_shift(
            schedule_id, "tuesday", "08:00", "10:00", required_technicians=2
        )

        response = self.client.post(f"/schedules/generate/{schedule_id}")
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

        # Every generated assignment should default to the "Working"
        # category so the published view has something sensible to show.
        for a in assignments:
            self.assertIsNotNone(a["category_id"])

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
        get_response = self.client.get(f"/schedules/{schedule_id}")
        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(
            len(get_response.json()["assignments"]), 3
        )

    def test_generate_is_idempotent_and_regenerates(self):
        campaign, sched = self.make_campaign_and_schedule()
        campaign_id = campaign["id"]
        schedule_id = sched["id"]

        tech = self.create_technician("Solo Tech", "solo@example.com")
        self.submit_availability(
            tech["id"], campaign_id, "monday", "08:00", "12:00", "available"
        )
        self.create_shift(schedule_id, "monday", "08:00", "12:00")

        first = self.client.post(f"/schedules/generate/{schedule_id}")
        second = self.client.post(f"/schedules/generate/{schedule_id}")

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        # Regenerating should not duplicate assignments.
        self.assertEqual(len(second.json()["assignments"]), 1)

    def test_generate_requires_at_least_one_shift(self):
        _, sched = self.make_campaign_and_schedule()

        response = self.client.post(f"/schedules/generate/{sched['id']}")
        self.assertEqual(response.status_code, 422)

    def test_edit_assignment_rejects_technician_without_availability(self):
        campaign, sched = self.make_campaign_and_schedule()
        campaign_id = campaign["id"]
        schedule_id = sched["id"]

        tech_a = self.create_technician("Ava", "ava2@example.com")
        tech_d = self.create_technician("Dee", "dee2@example.com")

        self.submit_availability(
            tech_a["id"], campaign_id, "monday", "08:00", "12:00", "available"
        )
        self.create_shift(schedule_id, "monday", "08:00", "12:00")

        generated = self.client.post(f"/schedules/generate/{schedule_id}")
        assignment_id = generated.json()["assignments"][0]["id"]

        response = self.client.patch(
            f"/schedules/assignments/{assignment_id}",
            json={"technician_id": tech_d["id"]},
        )

        self.assertEqual(response.status_code, 422)

        # A rejected reassignment must not mutate the assignment: the
        # previously (validly) assigned technician stays in place.
        board = self.client.get(f"/schedules/{schedule_id}").json()
        persisted = next(
            a for a in board["assignments"] if a["id"] == assignment_id
        )
        self.assertEqual(persisted["technician_id"], tech_a["id"])

    def test_edit_assignment_rejects_overlap(self):
        campaign, sched = self.make_campaign_and_schedule()
        campaign_id = campaign["id"]
        schedule_id = sched["id"]

        tech_a = self.create_technician("Ava", "ava3@example.com")
        tech_b = self.create_technician("Ben", "ben3@example.com")

        self.submit_availability(
            tech_a["id"], campaign_id, "monday", "08:00", "16:00", "available"
        )
        self.submit_availability(
            tech_b["id"], campaign_id, "monday", "08:00", "16:00", "available"
        )

        shift_1 = self.create_shift(schedule_id, "monday", "08:00", "16:00")
        shift_2 = self.create_shift(schedule_id, "monday", "09:00", "11:00")

        generated = self.client.post(
            f"/schedules/generate/{schedule_id}"
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
        campaign, sched = self.make_campaign_and_schedule()
        campaign_id = campaign["id"]
        schedule_id = sched["id"]

        tech_a = self.create_technician("Ava", "ava4@example.com")
        tech_b = self.create_technician("Ben", "ben4@example.com")

        self.submit_availability(
            tech_a["id"], campaign_id, "monday", "08:00", "12:00", "available"
        )
        self.submit_availability(
            tech_b["id"], campaign_id, "monday", "08:00", "12:00", "available"
        )

        self.create_shift(schedule_id, "monday", "08:00", "12:00")

        generated = self.client.post(
            f"/schedules/generate/{schedule_id}"
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

    def test_edit_assignment_can_change_category(self):
        campaign, sched = self.make_campaign_and_schedule()
        campaign_id = campaign["id"]
        schedule_id = sched["id"]

        tech_a = self.create_technician("Ava", "ava-cat@example.com")
        self.submit_availability(
            tech_a["id"], campaign_id, "monday", "08:00", "12:00", "available"
        )
        self.create_shift(schedule_id, "monday", "08:00", "12:00")

        generated = self.client.post(
            f"/schedules/generate/{schedule_id}"
        ).json()
        assignment = generated["assignments"][0]

        categories = self.client.get("/schedule-categories/").json()
        on_leave = next(c for c in categories if c["name"] == "On Leave")

        response = self.client.patch(
            f"/schedules/assignments/{assignment['id']}",
            json={"category_id": on_leave["id"]},
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["category_id"], on_leave["id"])
        # Technician must be unchanged since only the category was sent.
        self.assertEqual(
            response.json()["technician_id"], tech_a["id"]
        )

    def test_generate_missing_schedule_returns_404(self):
        response = self.client.post("/schedules/generate/9999")
        self.assertEqual(response.status_code, 404)

    def test_publish_requires_assignments(self):
        _, sched = self.make_campaign_and_schedule()

        response = self.client.post(
            f"/schedules/publish/{sched['id']}"
        )

        self.assertEqual(response.status_code, 422)

    def test_publish_requires_admin(self):
        _, sched = self.make_campaign_and_schedule()

        app.dependency_overrides.pop(get_current_admin, None)

        response = self.client.post(
            f"/schedules/publish/{sched['id']}"
        )

        self.assertEqual(response.status_code, 401)

        app.dependency_overrides[get_current_admin] = (
            _override_get_current_admin
        )

    def test_publish_is_stable_and_public_endpoint_works(self):
        campaign, sched = self.make_campaign_and_schedule()
        campaign_id = campaign["id"]
        schedule_id = sched["id"]

        tech = self.create_technician(
            "Pat Published", "pat.published@example.com"
        )
        self.submit_availability(
            tech["id"], campaign_id, "monday", "08:00", "12:00", "available"
        )
        self.create_shift(schedule_id, "monday", "08:00", "12:00")

        self.client.post(f"/schedules/generate/{schedule_id}")

        first_publish = self.client.post(
            f"/schedules/publish/{schedule_id}"
        )
        self.assertEqual(first_publish.status_code, 200, first_publish.text)

        first_body = first_publish.json()
        self.assertTrue(first_body["published"])
        self.assertIsNotNone(first_body["public_token"])
        token = first_body["public_token"]

        # Publishing again must keep the same token (stable link).
        second_publish = self.client.post(
            f"/schedules/publish/{schedule_id}"
        )
        self.assertEqual(second_publish.status_code, 200)
        self.assertEqual(second_publish.json()["public_token"], token)

        # The public endpoint must work with no admin session at all.
        app.dependency_overrides.pop(get_current_admin, None)

        public_response = self.client.get(f"/schedules/public/{token}")
        self.assertEqual(
            public_response.status_code, 200, public_response.text
        )

        public_body = public_response.json()
        self.assertEqual(public_body["schedule_name"], sched["name"])
        self.assertEqual(len(public_body["assignments"]), 1)
        self.assertEqual(
            public_body["assignments"][0]["technician_name"],
            "Pat Published",
        )
        self.assertEqual(public_body["assignments"][0]["day_of_week"], "monday")
        self.assertEqual(
            public_body["assignments"][0]["category_name"], "Working"
        )
        self.assertEqual(len(public_body["technician_hours"]), 1)
        self.assertAlmostEqual(
            public_body["technician_hours"][0]["assigned_hours"], 4.0
        )

        # A still-admin-gated endpoint must reject the same unauthenticated
        # client to prove the public endpoint's openness is intentional,
        # not a blanket auth bypass.
        admin_response = self.client.get(f"/schedules/{schedule_id}")
        self.assertEqual(admin_response.status_code, 401)

        app.dependency_overrides[get_current_admin] = (
            _override_get_current_admin
        )

    def test_public_schedule_unknown_token_returns_404(self):
        response = self.client.get("/schedules/public/not-a-real-token")
        self.assertEqual(response.status_code, 404)

    def test_generate_schedule_uses_configured_minimum_weekly_hours(self):
        # A schedule can configure a minimum other than the old hardcoded
        # 15h floor; the below-minimum reporting must reflect whatever was
        # actually configured for this schedule.
        low_min_campaign, low_min_sched = self.make_campaign_and_schedule(
            minimum_weekly_hours=10
        )
        low_min_campaign_id = low_min_campaign["id"]
        low_min_id = low_min_sched["id"]

        tech = self.create_technician(
            "Low Minimum Tech", "lowmin@example.com"
        )
        self.submit_availability(
            tech["id"], low_min_campaign_id, "monday", "08:00", "20:00", "available"
        )
        # 12 hours: below the old hardcoded 15h floor, but at/above this
        # schedule's configured 10h floor.
        self.create_shift(low_min_id, "monday", "08:00", "20:00")

        low_min_body = self.client.post(
            f"/schedules/generate/{low_min_id}"
        ).json()

        self.assertEqual(low_min_body["minimum_weekly_hours"], 10)

        low_min_below = {
            item["technician_id"]
            for item in low_min_body["technicians_below_minimum"]
        }
        self.assertNotIn(tech["id"], low_min_below)

        # A higher configured minimum must flag a technician who would
        # have cleared the old hardcoded 15h floor.
        high_min_campaign, high_min_sched = self.make_campaign_and_schedule(
            minimum_weekly_hours=20
        )
        high_min_campaign_id = high_min_campaign["id"]
        high_min_id = high_min_sched["id"]

        tech_2 = self.create_technician(
            "High Minimum Tech", "highmin@example.com"
        )
        self.submit_availability(
            tech_2["id"], high_min_campaign_id, "monday", "08:00", "16:00", "available"
        )
        # 8 hours: at/above the old hardcoded 15h floor is false anyway,
        # but well below this schedule's configured 20h floor.
        self.create_shift(high_min_id, "monday", "08:00", "16:00")

        high_min_body = self.client.post(
            f"/schedules/generate/{high_min_id}"
        ).json()

        self.assertEqual(high_min_body["minimum_weekly_hours"], 20)

        high_min_below = {
            item["technician_id"]: item
            for item in high_min_body["technicians_below_minimum"]
        }
        self.assertIn(tech_2["id"], high_min_below)
        self.assertAlmostEqual(
            high_min_below[tech_2["id"]]["shortfall_hours"], 12.0
        )

    # -- standalone schedule tests (no linked Availability Request) -----

    def test_create_schedule_without_campaign(self):
        response = self.client.post(
            "/schedules/",
            json={"name": "Manual Fall Schedule"},
        )
        self.assertEqual(response.status_code, 201, response.text)
        body = response.json()
        self.assertIsNone(body["campaign_id"])
        self.assertEqual(body["status"], "draft")

    def test_manual_assignment_on_standalone_schedule_skips_availability_check(
        self,
    ):
        sched = self.create_standalone_schedule()
        tech = self.create_technician(
            "No Availability Needed", "manual@example.com"
        )
        shift = self.create_shift(sched["id"], "monday", "08:00", "12:00")

        response = self.client.post(
            f"/schedules/{sched['id']}/assignments",
            json={"shift_id": shift["id"], "technician_id": tech["id"]},
        )

        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["technician_id"], tech["id"])
        # Default category should be applied even for a manual assignment.
        self.assertIsNotNone(response.json()["category_id"])

    def test_manual_assignment_on_linked_schedule_still_requires_availability(
        self,
    ):
        campaign, sched = self.make_campaign_and_schedule()
        tech = self.create_technician(
            "Did Not Submit", "didnotsubmit@example.com"
        )
        shift = self.create_shift(sched["id"], "monday", "08:00", "12:00")

        response = self.client.post(
            f"/schedules/{sched['id']}/assignments",
            json={"shift_id": shift["id"], "technician_id": tech["id"]},
        )

        self.assertEqual(response.status_code, 422)

    def test_manual_assignment_rejects_duplicate_for_same_shift(self):
        sched = self.create_standalone_schedule()
        tech = self.create_technician("Dup Tech", "dup@example.com")
        shift = self.create_shift(sched["id"], "monday", "08:00", "12:00")

        first = self.client.post(
            f"/schedules/{sched['id']}/assignments",
            json={"shift_id": shift["id"], "technician_id": tech["id"]},
        )
        self.assertEqual(first.status_code, 201, first.text)

        second = self.client.post(
            f"/schedules/{sched['id']}/assignments",
            json={"shift_id": shift["id"], "technician_id": tech["id"]},
        )
        self.assertEqual(second.status_code, 409)

    def test_generate_on_standalone_schedule_leaves_everything_uncovered(
        self,
    ):
        sched = self.create_standalone_schedule()
        self.create_shift(sched["id"], "monday", "08:00", "12:00")

        response = self.client.post(f"/schedules/generate/{sched['id']}")
        self.assertEqual(response.status_code, 201, response.text)

        body = response.json()
        self.assertEqual(body["assignments"], [])
        self.assertEqual(len(body["uncovered_shifts"]), 1)

    def test_publish_standalone_schedule(self):
        sched = self.create_standalone_schedule()
        tech = self.create_technician(
            "Standalone Pub", "standalonepub@example.com"
        )
        shift = self.create_shift(sched["id"], "monday", "08:00", "12:00")

        self.client.post(
            f"/schedules/{sched['id']}/assignments",
            json={"shift_id": shift["id"], "technician_id": tech["id"]},
        )

        response = self.client.post(f"/schedules/publish/{sched['id']}")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(response.json()["published"])

        token = response.json()["public_token"]

        app.dependency_overrides.pop(get_current_admin, None)
        public_response = self.client.get(f"/schedules/public/{token}")
        self.assertEqual(public_response.status_code, 200)
        self.assertEqual(len(public_response.json()["assignments"]), 1)

        app.dependency_overrides[get_current_admin] = (
            _override_get_current_admin
        )

    def test_list_schedules_includes_standalone_and_linked(self):
        campaign, linked = self.make_campaign_and_schedule()
        standalone = self.create_standalone_schedule(
            name="Just A Manual One"
        )

        response = self.client.get("/schedules/")
        self.assertEqual(response.status_code, 200)

        by_id = {row["id"]: row for row in response.json()}
        self.assertIn(linked["id"], by_id)
        self.assertIn(standalone["id"], by_id)
        self.assertEqual(
            by_id[linked["id"]]["campaign_name"], campaign["name"]
        )
        self.assertIsNone(by_id[standalone["id"]]["campaign_name"])

    # -- locations --------------------------------------------------------

    def test_shift_can_have_a_location(self):
        sched = self.create_standalone_schedule()

        location_response = self.client.post(
            "/locations/", json={"name": "Carson High School"}
        )
        self.assertEqual(location_response.status_code, 201)
        location_id = location_response.json()["id"]

        shift = self.create_shift(
            sched["id"],
            "monday",
            "08:00",
            "12:00",
            location_id=location_id,
        )
        self.assertEqual(shift["location_id"], location_id)


if __name__ == "__main__":
    unittest.main()
