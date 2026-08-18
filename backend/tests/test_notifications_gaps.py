"""
Section P (Notifications) gaps not already covered by
tests/test_notifications.py: empty state, mark-all-read scope, unread
count accuracy, notification links, dedupe-across-refresh, and the
missing dismiss/clear action.

Run with:
    cd backend && python3 -m unittest tests.test_notifications_gaps -v
"""

import unittest

from tests._helpers import ApiTestCase
from app.core.auth_dependencies import get_current_admin
from app.main import app


class NotificationGapTestCase(ApiTestCase):
    def test_empty_notification_state(self):
        response = self.client.get("/notifications/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["unread_count"], 0)
        self.assertEqual(response.json()["notifications"], [])

    def test_notification_requires_admin(self):
        app.dependency_overrides.pop(get_current_admin, None)
        response = self.client.get("/notifications/")
        self.assertIn(response.status_code, (401, 403))

    def test_availability_submission_notification_has_a_link(self):
        campaign = self.create_campaign()
        self.create_technician("Link Tech", "linktech@example.com")
        self.submit_public_availability(
            campaign["public_token"],
            "linktech@example.com",
            [
                {
                    "day_of_week": "monday",
                    "start_time": "09:00:00",
                    "end_time": "12:00:00",
                    "availability_type": "available",
                }
            ],
        )

        response = self.client.get("/notifications/")
        notifications = response.json()["notifications"]
        self.assertEqual(len(notifications), 1)
        self.assertIsNotNone(notifications[0]["link"])
        self.assertIsNotNone(notifications[0]["created_at"])

    def test_unread_count_reflects_only_unread(self):
        campaign = self.create_campaign()
        self.create_technician("Unread Tech", "unreadtech@example.com")
        self.submit_public_availability(
            campaign["public_token"],
            "unreadtech@example.com",
            [
                {
                    "day_of_week": "monday",
                    "start_time": "09:00:00",
                    "end_time": "12:00:00",
                    "availability_type": "available",
                }
            ],
        )

        listing = self.client.get("/notifications/")
        self.assertEqual(listing.json()["unread_count"], 1)

        notification_id = listing.json()["notifications"][0]["id"]
        mark_read = self.client.post(f"/notifications/{notification_id}/read")
        self.assertEqual(mark_read.status_code, 200)
        self.assertTrue(mark_read.json()["is_read"])

        after = self.client.get("/notifications/")
        self.assertEqual(after.json()["unread_count"], 0)

    def test_mark_all_read_clears_unread_count(self):
        campaign = self.create_campaign()
        self.create_technician("Tech One", "techone@example.com")
        self.create_technician("Tech Two", "techtwo@example.com")

        for email in ("techone@example.com", "techtwo@example.com"):
            self.submit_public_availability(
                campaign["public_token"],
                email,
                [
                    {
                        "day_of_week": "monday",
                        "start_time": "09:00:00",
                        "end_time": "12:00:00",
                        "availability_type": "available",
                    }
                ],
            )

        before = self.client.get("/notifications/")
        self.assertEqual(before.json()["unread_count"], 2)

        response = self.client.post("/notifications/read-all")
        self.assertEqual(response.status_code, 204)

        after = self.client.get("/notifications/")
        self.assertEqual(after.json()["unread_count"], 0)
        self.assertEqual(len(after.json()["notifications"]), 2)

    def test_mark_notification_read_not_found_404(self):
        response = self.client.post("/notifications/999/read")
        self.assertEqual(response.status_code, 404)

    def test_repeated_reads_do_not_create_duplicate_uncovered_notifications(self):
        schedule = self.create_schedule(name="Repeated Read Schedule")
        self.create_shift(schedule["id"], "monday", "09:00", "12:00")

        first = self.client.get("/notifications/")
        second = self.client.get("/notifications/")
        third = self.client.get("/notifications/")

        uncovered_notifications = [
            n
            for n in third.json()["notifications"]
            if n["type"] == "uncovered_shifts"
        ]
        self.assertEqual(len(uncovered_notifications), 1)
        self.assertEqual(first.json()["unread_count"], third.json()["unread_count"])

    def test_read_uncovered_notification_stays_read_across_refreshes(self):
        # Regression guard for the "resurrected as unread" bug class:
        # re-touching an existing dedupe_key on every /notifications/ call
        # must not flip is_read back to False.
        schedule = self.create_schedule(name="Stays Read Schedule")
        self.create_shift(schedule["id"], "monday", "09:00", "12:00")

        listing = self.client.get("/notifications/")
        notification_id = listing.json()["notifications"][0]["id"]
        self.client.post(f"/notifications/{notification_id}/read")

        after = self.client.get("/notifications/")
        matching = [
            n for n in after.json()["notifications"] if n["id"] == notification_id
        ]
        self.assertEqual(len(matching), 1)
        self.assertTrue(matching[0]["is_read"])

    def test_uncovered_shift_notification_clears_once_covered(self):
        schedule = self.create_schedule(name="Clears Once Covered Schedule")
        shift = self.create_shift(schedule["id"], "monday", "09:00", "12:00")
        technician = self.create_technician(
            "Coverage Tech", "coveragetech@example.com"
        )

        before = self.client.get("/notifications/")
        self.assertTrue(
            any(
                n["type"] == "uncovered_shifts"
                for n in before.json()["notifications"]
            )
        )

        self.client.post(
            f"/schedules/{schedule['id']}/assignments",
            json={"shift_id": shift["id"], "technician_id": technician["id"]},
        )

        after = self.client.get("/notifications/")
        self.assertFalse(
            any(
                n["type"] == "uncovered_shifts"
                for n in after.json()["notifications"]
            )
        )

    def test_dismiss_notification_removes_it_permanently(self):
        campaign = self.create_campaign()
        self.create_technician("Dismiss Tech", "dismisstech@example.com")
        self.submit_public_availability(
            campaign["public_token"],
            "dismisstech@example.com",
            [
                {
                    "day_of_week": "monday",
                    "start_time": "09:00:00",
                    "end_time": "12:00:00",
                    "availability_type": "available",
                }
            ],
        )
        listing = self.client.get("/notifications/")
        notification_id = listing.json()["notifications"][0]["id"]

        response = self.client.delete(f"/notifications/{notification_id}")
        self.assertEqual(response.status_code, 204, response.text)

        after = self.client.get("/notifications/")
        ids = [n["id"] for n in after.json()["notifications"]]
        self.assertNotIn(notification_id, ids)

    def test_dismissing_unread_notification_reduces_unread_count(self):
        campaign = self.create_campaign()
        self.create_technician("Dismiss Unread Tech", "dismissunread@example.com")
        self.submit_public_availability(
            campaign["public_token"],
            "dismissunread@example.com",
            [
                {
                    "day_of_week": "monday",
                    "start_time": "09:00:00",
                    "end_time": "12:00:00",
                    "availability_type": "available",
                }
            ],
        )
        listing = self.client.get("/notifications/")
        self.assertEqual(listing.json()["unread_count"], 1)
        notification_id = listing.json()["notifications"][0]["id"]

        self.client.delete(f"/notifications/{notification_id}")

        after = self.client.get("/notifications/")
        self.assertEqual(after.json()["unread_count"], 0)

    def test_dismiss_unknown_notification_returns_404(self):
        response = self.client.delete("/notifications/999")
        self.assertEqual(response.status_code, 404)

    def test_dismiss_requires_admin(self):
        app.dependency_overrides.pop(get_current_admin, None)
        response = self.client.delete("/notifications/1")
        self.assertIn(response.status_code, (401, 403))

    def test_clear_read_removes_only_read_notifications(self):
        campaign = self.create_campaign()
        self.create_technician("Clear Read Tech A", "clearreada@example.com")
        self.create_technician("Clear Read Tech B", "clearreadb@example.com")

        for email in ("clearreada@example.com", "clearreadb@example.com"):
            self.submit_public_availability(
                campaign["public_token"],
                email,
                [
                    {
                        "day_of_week": "monday",
                        "start_time": "09:00:00",
                        "end_time": "12:00:00",
                        "availability_type": "available",
                    }
                ],
            )

        listing = self.client.get("/notifications/")
        notifications = listing.json()["notifications"]
        self.assertEqual(len(notifications), 2)

        # Mark only the first one read; leave the second unread.
        self.client.post(f"/notifications/{notifications[0]['id']}/read")

        response = self.client.post("/notifications/clear-read")
        self.assertEqual(response.status_code, 204, response.text)

        after = self.client.get("/notifications/")
        remaining_ids = [n["id"] for n in after.json()["notifications"]]
        self.assertNotIn(notifications[0]["id"], remaining_ids)
        self.assertIn(notifications[1]["id"], remaining_ids)
        self.assertEqual(len(remaining_ids), 1)

    def test_clear_read_requires_admin(self):
        app.dependency_overrides.pop(get_current_admin, None)
        response = self.client.post("/notifications/clear-read")
        self.assertIn(response.status_code, (401, 403))


if __name__ == "__main__":
    unittest.main()
