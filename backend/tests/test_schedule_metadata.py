"""
Section G (Schedule Creation) gaps not already covered by
tests/test_scheduling.py: metadata round-trips, editing, and multiple
schedules coexisting independently of each other.

Run with:
    cd backend && python3 -m unittest tests.test_schedule_metadata -v
"""

import unittest

from tests._helpers import ApiTestCase


class ScheduleMetadataTestCase(ApiTestCase):
    def test_create_standalone_schedule_with_full_metadata(self):
        response = self.client.post(
            "/schedules/",
            json={
                "name": "Spring 2027 Outreach",
                "start_date": "2027-01-15",
                "end_date": "2027-05-15",
                "semester": "Spring 2027",
                "notes": "Covers the robotics outreach program only.",
                "minimum_weekly_hours": 10,
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        body = response.json()
        self.assertEqual(body["name"], "Spring 2027 Outreach")
        self.assertEqual(body["start_date"], "2027-01-15")
        self.assertEqual(body["end_date"], "2027-05-15")
        self.assertEqual(body["semester"], "Spring 2027")
        self.assertIn("robotics", body["notes"])
        self.assertIsNone(body["campaign_id"])
        self.assertEqual(body["status"], "draft")

    def test_create_schedule_requires_name(self):
        response = self.client.post("/schedules/", json={})
        self.assertEqual(response.status_code, 422)

    def test_create_schedule_rejects_unknown_campaign(self):
        response = self.client.post(
            "/schedules/", json={"name": "Bad Campaign Link", "campaign_id": 999}
        )
        self.assertEqual(response.status_code, 404)

    def test_create_schedule_requires_admin(self):
        from app.core.auth_dependencies import get_current_admin
        from app.main import app

        app.dependency_overrides.pop(get_current_admin, None)
        response = self.client.post("/schedules/", json={"name": "No Auth Schedule"})
        self.assertIn(response.status_code, (401, 403))

    def test_edit_schedule_metadata(self):
        schedule = self.create_schedule(name="Original Name")
        response = self.client.patch(
            f"/schedules/{schedule['id']}",
            json={
                "name": "Renamed Schedule",
                "notes": "Updated after the fact.",
                "minimum_weekly_hours": 12,
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["name"], "Renamed Schedule")
        self.assertEqual(response.json()["notes"], "Updated after the fact.")
        self.assertEqual(response.json()["minimum_weekly_hours"], 12)

    def test_edit_schedule_not_found_404(self):
        response = self.client.patch("/schedules/999", json={"name": "Ghost"})
        self.assertEqual(response.status_code, 404)

    def test_edit_schedule_can_attach_a_campaign_after_creation(self):
        campaign = self.create_campaign()
        schedule = self.create_schedule(name="Attach Later Schedule")
        self.assertIsNone(schedule["campaign_id"])

        response = self.client.patch(
            f"/schedules/{schedule['id']}", json={"campaign_id": campaign["id"]}
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["campaign_id"], campaign["id"])

    def test_multiple_schedules_can_exist_independently(self):
        first = self.create_schedule(name="Schedule One")
        second = self.create_schedule(name="Schedule Two")
        self.assertNotEqual(first["id"], second["id"])

        listing = self.client.get("/schedules/")
        names = {row["name"] for row in listing.json()}
        self.assertIn("Schedule One", names)
        self.assertIn("Schedule Two", names)

    def test_schedule_with_no_shifts_has_empty_board(self):
        schedule = self.create_schedule(name="Empty Schedule")
        board = self.client.get(f"/schedules/{schedule['id']}")
        self.assertEqual(board.status_code, 200)
        self.assertEqual(board.json()["assignments"], [])
        self.assertEqual(board.json()["uncovered_shifts"], [])

    def test_get_schedule_not_found_404(self):
        response = self.client.get("/schedules/999")
        self.assertEqual(response.status_code, 404)

    def test_list_schedules_requires_admin(self):
        from app.core.auth_dependencies import get_current_admin
        from app.main import app

        app.dependency_overrides.pop(get_current_admin, None)
        response = self.client.get("/schedules/")
        self.assertIn(response.status_code, (401, 403))

    def test_schedule_shift_and_assignment_counts_reflect_actual_data(self):
        schedule = self.create_schedule(name="Counts Schedule")
        shift = self.create_shift(schedule["id"], "monday", "09:00", "12:00")
        technician = self.create_technician("Counts Tech", "countstech@example.com")
        self.client.post(
            f"/schedules/{schedule['id']}/assignments",
            json={"shift_id": shift["id"], "technician_id": technician["id"]},
        )

        listing = self.client.get("/schedules/")
        matching = [row for row in listing.json() if row["id"] == schedule["id"]][0]
        self.assertEqual(matching["shift_count"], 1)
        self.assertEqual(matching["assignment_count"], 1)


if __name__ == "__main__":
    unittest.main()
