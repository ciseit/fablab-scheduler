"""
Section K (Locations/Sites) and Section L (Schedule Categories/Statuses/
Colors), plus the accessibility requirement that color is never the only
way a status is communicated.

Run with:
    cd backend && python3 -m unittest tests.test_locations_and_categories -v
"""

import unittest

from tests._helpers import ApiTestCase
from app.core.auth_dependencies import get_current_admin
from app.main import app


class LocationTestCase(ApiTestCase):
    def test_create_location(self):
        location = self.create_location(name="Carson High School")
        self.assertEqual(location["name"], "Carson High School")
        self.assertTrue(location["is_active"])

    def test_create_location_rejects_blank_name(self):
        response = self.client.post("/locations/", json={"name": ""})
        self.assertEqual(response.status_code, 422)

    def test_create_location_rejects_duplicate_name(self):
        self.create_location(name="FABLAB")
        response = self.client.post("/locations/", json={"name": "FABLAB"})
        self.assertEqual(response.status_code, 409)

    def test_create_location_rejects_duplicate_name_different_case(self):
        self.create_location(name="FABLAB")
        response = self.client.post("/locations/", json={"name": "fablab"})
        self.assertEqual(response.status_code, 409)

    def test_create_location_requires_admin(self):
        app.dependency_overrides.pop(get_current_admin, None)
        response = self.client.post("/locations/", json={"name": "No Auth"})
        self.assertIn(response.status_code, (401, 403))

    def test_update_location_rename(self):
        location = self.create_location(name="Old Name")
        response = self.client.patch(
            f"/locations/{location['id']}", json={"name": "New Name"}
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["name"], "New Name")

    def test_update_location_deactivate_is_the_archive_workflow(self):
        location = self.create_location(name="Seasonal Outreach Site")
        response = self.client.patch(
            f"/locations/{location['id']}", json={"is_active": False}
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertFalse(response.json()["is_active"])

        # The record survives (it's an archive, not a delete): it drops
        # out of the default (active-only) list used by dropdowns, but
        # is still visible via include_inactive=true (what Settings uses)
        # and can be reactivated.
        default_listing = self.client.get("/locations/")
        self.assertNotIn(
            "Seasonal Outreach Site",
            [loc["name"] for loc in default_listing.json()],
        )

        settings_listing = self.client.get(
            "/locations/?include_inactive=true"
        )
        self.assertIn(
            "Seasonal Outreach Site",
            [loc["name"] for loc in settings_listing.json()],
        )

    def test_update_location_reactivate(self):
        location = self.create_location(name="Reactivate Me")
        self.client.patch(
            f"/locations/{location['id']}", json={"is_active": False}
        )
        response = self.client.patch(
            f"/locations/{location['id']}", json={"is_active": True}
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["is_active"])

    def test_update_location_not_found_404(self):
        response = self.client.patch("/locations/999", json={"name": "X"})
        self.assertEqual(response.status_code, 404)

    def test_get_locations_is_public(self):
        app.dependency_overrides.pop(get_current_admin, None)
        response = self.client.get("/locations/")
        self.assertEqual(response.status_code, 200)

    def test_shift_can_reference_a_location_and_it_persists(self):
        location = self.create_location(name="Robotics Lab")
        schedule = self.create_schedule(name="Loc Test Schedule")
        shift = self.create_shift(
            schedule["id"], "monday", "09:00", "12:00", location_id=location["id"]
        )
        self.assertEqual(shift["location_id"], location["id"])

    def test_shift_creation_rejects_unknown_location(self):
        schedule = self.create_schedule(name="Bad Location Schedule")
        response = self.client.post(
            "/shifts/",
            json={
                "schedule_id": schedule["id"],
                "location_id": 999,
                "day_of_week": "monday",
                "start_time": "09:00:00",
                "end_time": "12:00:00",
                "required_technicians": 1,
            },
        )
        self.assertEqual(response.status_code, 404)

    def test_default_location_list_excludes_archived(self):
        self.create_location(name="Active Site")
        archived = self.create_location(name="Archived Site")
        self.client.patch(
            f"/locations/{archived['id']}", json={"is_active": False}
        )

        response = self.client.get("/locations/")
        names = {loc["name"] for loc in response.json()}
        self.assertIn("Active Site", names)
        self.assertNotIn("Archived Site", names)

    def test_include_inactive_flag_returns_archived_locations_too(self):
        archived = self.create_location(name="Archived Site For Settings")
        self.client.patch(
            f"/locations/{archived['id']}", json={"is_active": False}
        )

        response = self.client.get("/locations/?include_inactive=true")
        names = {loc["name"] for loc in response.json()}
        self.assertIn("Archived Site For Settings", names)

    def test_shift_creation_rejects_archived_location(self):
        location = self.create_location(name="Retiring Site")
        self.client.patch(
            f"/locations/{location['id']}", json={"is_active": False}
        )
        schedule = self.create_schedule(name="Archived Location Schedule")

        response = self.client.post(
            "/shifts/",
            json={
                "schedule_id": schedule["id"],
                "location_id": location["id"],
                "day_of_week": "monday",
                "start_time": "09:00:00",
                "end_time": "12:00:00",
                "required_technicians": 1,
            },
        )
        self.assertEqual(response.status_code, 422, response.text)
        self.assertIn("archived", response.json()["detail"].lower())

    def test_no_delete_endpoint_exists_for_locations(self):
        # Diana's spec calls for "delete when safe" for unused records.
        # Today there is no DELETE route at all for locations -- only
        # create + archive (is_active). This test documents that gap so
        # it's visible in the Phase 1 report rather than silently absent.
        location = self.create_location(name="Never Used Location")
        response = self.client.delete(f"/locations/{location['id']}")
        self.assertEqual(response.status_code, 405)


class ScheduleCategoryTestCase(ApiTestCase):
    def test_create_category(self):
        category = self.create_category(name="Outreach Duty", color="#f97316")
        self.assertEqual(category["name"], "Outreach Duty")
        self.assertEqual(category["color"], "#f97316")
        self.assertTrue(category["is_active"])

    def test_create_category_rejects_invalid_hex_color(self):
        response = self.client.post(
            "/schedule-categories/",
            json={"name": "Bad Color", "color": "not-a-color"},
        )
        self.assertEqual(response.status_code, 422)

    def test_create_category_rejects_three_digit_hex_shorthand(self):
        # Only 6-digit hex is accepted per the schema pattern; a common
        # shorthand like "#fff" should be rejected, not silently coerced.
        response = self.client.post(
            "/schedule-categories/",
            json={"name": "Shorthand Color", "color": "#fff"},
        )
        self.assertEqual(response.status_code, 422)

    def test_create_category_rejects_duplicate_name(self):
        self.create_category(name="Weekend Coverage", color="#2563eb")
        response = self.client.post(
            "/schedule-categories/",
            json={"name": "Weekend Coverage", "color": "#000000"},
        )
        self.assertEqual(response.status_code, 409)

    def test_create_category_requires_admin(self):
        app.dependency_overrides.pop(get_current_admin, None)
        response = self.client.post(
            "/schedule-categories/",
            json={"name": "No Auth", "color": "#000000"},
        )
        self.assertIn(response.status_code, (401, 403))

    def test_update_category_rename(self):
        category = self.create_category(name="Old Status", color="#111111")
        response = self.client.patch(
            f"/schedule-categories/{category['id']}",
            json={"name": "New Status"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "New Status")

    def test_update_category_change_color(self):
        category = self.create_category(name="Sick Leave", color="#dc2626")
        response = self.client.patch(
            f"/schedule-categories/{category['id']}",
            json={"color": "#16a34a"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["color"], "#16a34a")

    def test_archive_category(self):
        category = self.create_category(name="Deprecated Status", color="#999999")
        response = self.client.patch(
            f"/schedule-categories/{category['id']}", json={"is_active": False}
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["is_active"])

    def test_archived_category_cannot_be_assigned_to_a_new_assignment(self):
        category = self.create_category(name="Retired Status", color="#555555")
        self.client.patch(
            f"/schedule-categories/{category['id']}", json={"is_active": False}
        )

        schedule = self.create_schedule(name="Archived Category Schedule")
        shift = self.create_shift(schedule["id"], "monday", "09:00", "12:00")
        tech = self.create_technician("Archived Cat Tech", "archivedcat@example.com")

        response = self.client.post(
            f"/schedules/{schedule['id']}/assignments",
            json={
                "shift_id": shift["id"],
                "technician_id": tech["id"],
                "category_id": category["id"],
            },
        )
        self.assertEqual(response.status_code, 422, response.text)
        self.assertIn("archived", response.json()["detail"].lower())

    def test_default_category_list_excludes_archived(self):
        archived = self.create_category(name="Retiring Status", color="#654321")
        self.client.patch(
            f"/schedule-categories/{archived['id']}", json={"is_active": False}
        )

        response = self.client.get("/schedule-categories/")
        names = {c["name"] for c in response.json()}
        self.assertNotIn("Retiring Status", names)

    def test_include_inactive_flag_returns_archived_categories_too(self):
        archived = self.create_category(
            name="Archived Status For Settings", color="#654321"
        )
        self.client.patch(
            f"/schedule-categories/{archived['id']}", json={"is_active": False}
        )

        response = self.client.get(
            "/schedule-categories/?include_inactive=true"
        )
        names = {c["name"] for c in response.json()}
        self.assertIn("Archived Status For Settings", names)

    def test_get_categories_is_public(self):
        app.dependency_overrides.pop(get_current_admin, None)
        response = self.client.get("/schedule-categories/")
        self.assertEqual(response.status_code, 200)

    def test_no_delete_endpoint_exists_for_categories(self):
        category = self.create_category(name="Never Used Category", color="#123456")
        response = self.client.delete(f"/schedule-categories/{category['id']}")
        self.assertEqual(response.status_code, 405)

    def test_public_schedule_assignment_carries_both_category_name_and_color(self):
        # Accessibility requirement: color must never be the only signal.
        category = self.create_category(name="On Duty", color="#16a34a")
        schedule = self.create_schedule(name="Accessible Schedule")
        shift = self.create_shift(schedule["id"], "monday", "09:00", "12:00")
        tech = self.create_technician("A11y Tech", "a11y@example.com")

        self.client.post(
            f"/schedules/{schedule['id']}/assignments",
            json={
                "shift_id": shift["id"],
                "technician_id": tech["id"],
                "category_id": category["id"],
            },
        )
        publish = self.client.post(f"/schedules/publish/{schedule['id']}")
        self.assertEqual(publish.status_code, 200, publish.text)
        token = publish.json()["public_token"]

        public = self.client.get(f"/schedules/public/{token}")
        self.assertEqual(public.status_code, 200)
        assignment = public.json()["assignments"][0]
        self.assertEqual(assignment["category_name"], "On Duty")
        self.assertEqual(assignment["category_color"], "#16a34a")


if __name__ == "__main__":
    unittest.main()
