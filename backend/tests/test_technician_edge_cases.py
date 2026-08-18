"""
Section B (Technician Management) edge cases not already covered by
tests/test_technicians.py: validation boundaries, duplicate-email
handling, status transitions, and the delete-vs-archive boundary when a
technician is referenced by a published schedule.

Run with:
    cd backend && python3 -m unittest tests.test_technician_edge_cases -v
"""

import unittest

from tests._helpers import ApiTestCase


class TechnicianEdgeCaseTestCase(ApiTestCase):
    # -- validation -----------------------------------------------------

    def test_create_technician_missing_name_rejected(self):
        response = self.client.post(
            "/technicians/",
            json={
                "email": "noname@example.com",
                "designation": "Lab Technician",
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_create_technician_blank_name_rejected(self):
        response = self.client.post(
            "/technicians/",
            json={
                "name": "",
                "email": "blankname@example.com",
                "designation": "Lab Technician",
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_create_technician_missing_email_rejected(self):
        response = self.client.post(
            "/technicians/",
            json={"name": "No Email", "designation": "Lab Technician"},
        )
        self.assertEqual(response.status_code, 422)

    def test_create_technician_malformed_email_rejected(self):
        response = self.client.post(
            "/technicians/",
            json={
                "name": "Bad Email",
                "email": "not-an-email",
                "designation": "Lab Technician",
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_create_technician_duplicate_email_rejected(self):
        self.create_technician("First", "dup@example.com")
        response = self.client.post(
            "/technicians/",
            json={
                "name": "Second",
                "email": "dup@example.com",
                "designation": "Lab Technician",
            },
        )
        self.assertEqual(response.status_code, 409)

    def test_create_technician_duplicate_email_different_case_is_rejected(self):
        # Phase 1 finding, approved fix in Phase 2: technician email
        # uniqueness now dedupes case-insensitively, matching
        # Location/ScheduleCategory (_lower_eq) and the public
        # availability lookup (func.lower(Technician.email)).
        self.create_technician("First", "ava@example.com")
        response = self.client.post(
            "/technicians/",
            json={
                "name": "Second",
                "email": "AVA@EXAMPLE.COM",
                "designation": "Lab Technician",
            },
        )
        self.assertEqual(response.status_code, 409, response.text)

    def test_update_technician_email_conflict_is_case_insensitive(self):
        self.create_technician("First Owner", "caseowner1@example.com")
        second = self.create_technician("Second Owner", "caseowner2@example.com")

        response = self.client.patch(
            f"/technicians/{second['id']}",
            json={"email": "CASEOWNER1@EXAMPLE.COM"},
        )
        self.assertEqual(response.status_code, 409, response.text)

    def test_create_technician_negative_weekly_hours_rejected(self):
        response = self.client.post(
            "/technicians/",
            json={
                "name": "Negative Hours",
                "email": "neg@example.com",
                "designation": "Lab Technician",
                "weekly_target_hours": -5,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_create_technician_zero_weekly_hours_is_allowed(self):
        technician = self.create_technician(
            "Zero Hours", "zero@example.com", weekly_target_hours=0
        )
        self.assertEqual(technician["weekly_target_hours"], 0)

    def test_create_technician_unusually_high_weekly_hours_within_range(self):
        technician = self.create_technician(
            "High Hours", "high@example.com", weekly_target_hours=79
        )
        self.assertEqual(technician["weekly_target_hours"], 79)

    def test_create_technician_weekly_hours_above_max_rejected(self):
        response = self.client.post(
            "/technicians/",
            json={
                "name": "Too Many Hours",
                "email": "toomany@example.com",
                "designation": "Lab Technician",
                "weekly_target_hours": 81,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_create_technician_invalid_status_rejected(self):
        response = self.client.post(
            "/technicians/",
            json={
                "name": "Bad Status",
                "email": "badstatus@example.com",
                "designation": "Lab Technician",
                "status": "retired",
            },
        )
        self.assertEqual(response.status_code, 422)

    # -- lookups ----------------------------------------------------------

    def test_get_technician_not_found_404(self):
        response = self.client.get("/technicians/999")
        self.assertEqual(response.status_code, 404)

    def test_update_technician_not_found_404(self):
        response = self.client.patch(
            "/technicians/999", json={"name": "Ghost"}
        )
        self.assertEqual(response.status_code, 404)

    def test_delete_technician_not_found_404(self):
        response = self.client.delete("/technicians/999")
        self.assertEqual(response.status_code, 404)

    # -- status transitions ("archive" workflow) --------------------------

    def test_update_technician_status_to_inactive(self):
        technician = self.create_technician("Going Inactive", "inactive1@example.com")
        response = self.client.patch(
            f"/technicians/{technician['id']}", json={"status": "inactive"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "inactive")

    def test_update_technician_status_to_on_leave(self):
        technician = self.create_technician("Going On Leave", "onleave1@example.com")
        response = self.client.patch(
            f"/technicians/{technician['id']}", json={"status": "on_leave"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "on_leave")

    def test_inactive_technician_still_readable_after_status_change(self):
        technician = self.create_technician("Still Readable", "readable@example.com")
        self.client.patch(
            f"/technicians/{technician['id']}", json={"status": "inactive"}
        )
        response = self.client.get(f"/technicians/{technician['id']}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "inactive")

    def test_inactive_technician_excluded_from_generation_pool(self):
        active_tech = self.create_technician("Active One", "active1@example.com")
        inactive_tech = self.create_technician(
            "Inactive One", "inactive2@example.com", status="inactive"
        )

        campaign = self.create_campaign()
        for tech in (active_tech, inactive_tech):
            self.submit_availability(
                tech["id"], campaign["id"], "monday", "08:00", "12:00", "available"
            )

        schedule = self.create_schedule(campaign_id=campaign["id"])
        self.create_shift(schedule["id"], "monday", "08:00", "12:00")

        response = self.client.post(f"/schedules/generate/{schedule['id']}")
        self.assertEqual(response.status_code, 201, response.text)
        assigned_ids = {
            assignment["technician_id"]
            for assignment in response.json()["assignments"]
        }
        self.assertIn(active_tech["id"], assigned_ids)
        self.assertNotIn(inactive_tech["id"], assigned_ids)

    def test_assignment_to_inactive_technician_is_rejected(self):
        schedule = self.create_schedule(name="Inactive Assignment Schedule")
        shift = self.create_shift(schedule["id"], "monday", "09:00", "12:00")
        technician = self.create_technician(
            "Inactive Assignee", "inactiveassign@example.com", status="inactive"
        )

        response = self.client.post(
            f"/schedules/{schedule['id']}/assignments",
            json={"shift_id": shift["id"], "technician_id": technician["id"]},
        )
        self.assertEqual(response.status_code, 422, response.text)

    # -- deletion vs archive boundary -------------------------------------

    def test_technician_referenced_by_published_schedule_cannot_be_deleted(self):
        campaign = self.create_campaign()
        technician = self.create_technician(
            "Published Ref Tech", "publishedref@example.com"
        )
        self.submit_availability(
            technician["id"], campaign["id"], "monday", "08:00", "12:00", "available"
        )
        schedule = self.create_schedule(campaign_id=campaign["id"])
        self.create_shift(schedule["id"], "monday", "08:00", "12:00")
        self.client.post(f"/schedules/generate/{schedule['id']}")

        publish_response = self.client.post(f"/schedules/publish/{schedule['id']}")
        self.assertEqual(publish_response.status_code, 200, publish_response.text)

        delete_response = self.client.delete(f"/technicians/{technician['id']}")
        self.assertEqual(delete_response.status_code, 409)

        # Published history must survive intact.
        get_response = self.client.get(f"/technicians/{technician['id']}")
        self.assertEqual(get_response.status_code, 200)

    def test_setting_status_inactive_is_the_documented_archive_path_for_a_referenced_technician(
        self,
    ):
        campaign = self.create_campaign()
        technician = self.create_technician(
            "Archive Path Tech", "archivepath@example.com"
        )
        self.submit_availability(
            technician["id"], campaign["id"], "monday", "08:00", "12:00", "available"
        )

        delete_response = self.client.delete(f"/technicians/{technician['id']}")
        self.assertEqual(delete_response.status_code, 409)
        self.assertIn(
            "inactive", delete_response.json()["detail"].lower()
        )

        archive_response = self.client.patch(
            f"/technicians/{technician['id']}", json={"status": "inactive"}
        )
        self.assertEqual(archive_response.status_code, 200, archive_response.text)
        self.assertEqual(archive_response.json()["status"], "inactive")

    def test_update_technician_email_to_another_technicians_email_is_rejected(self):
        first = self.create_technician("First Owner", "owner1@example.com")
        self.create_technician("Second Owner", "owner2@example.com")

        response = self.client.patch(
            f"/technicians/{first['id']}", json={"email": "owner2@example.com"}
        )
        self.assertEqual(response.status_code, 409)


if __name__ == "__main__":
    unittest.main()
