"""
Phase 2, Decision 3: draft schedules can be freely deleted/edited; a
published schedule is protected from direct destructive changes and can
only be changed through the "Edit Published Schedule" workflow (clone to
a draft, edit the clone, republish to swap it in and retire the original
as superseded history).

Note: GET /schedules/{id} returns the *board* (assignments/coverage --
ScheduleBoardResponse), not schedule metadata like name/status/public_
token. To check metadata, use _find_schedule_row() against the list
endpoint (GET /schedules/, ScheduleListResponse) instead.

Run with:
    cd backend && python3 -m unittest tests.test_published_schedule_editing -v
"""

import unittest

from tests._helpers import ApiTestCase, _override_get_current_admin
from app.core.auth_dependencies import get_current_admin
from app.main import app


def _find_schedule_row(client, schedule_id):
    listing = client.get("/schedules/")
    matches = [row for row in listing.json() if row["id"] == schedule_id]
    assert matches, f"schedule {schedule_id} not found in listing"
    return matches[0]


class _PublishesScheduleMixin:
    def _publish_simple_schedule(self, name="Published Schedule"):
        schedule = self.create_schedule(name=name)
        shift = self.create_shift(schedule["id"], "monday", "09:00", "12:00")
        technician = self.create_technician(
            f"{name} Tech",
            f"{name.lower().replace(' ', '')}@example.com",
        )
        self.client.post(
            f"/schedules/{schedule['id']}/assignments",
            json={"shift_id": shift["id"], "technician_id": technician["id"]},
        )
        publish = self.client.post(f"/schedules/publish/{schedule['id']}")
        self.assertEqual(publish.status_code, 200, publish.text)

        # create_schedule()'s response predates publishing (no token
        # yet) -- refresh it from the publish result so callers get the
        # real public_token.
        schedule["public_token"] = publish.json()["public_token"]
        schedule["status"] = "published"

        return schedule, shift, technician


class PublishedScheduleProtectionTestCase(_PublishesScheduleMixin, ApiTestCase):
    """A published schedule rejects every direct mutation."""

    def test_delete_published_schedule_is_blocked(self):
        schedule, _shift, _tech = self._publish_simple_schedule()
        response = self.client.delete(f"/schedules/{schedule['id']}")
        self.assertEqual(response.status_code, 409, response.text)
        self.assertIn("published", response.json()["detail"].lower())

        # Untouched: still fetchable and still published.
        row = _find_schedule_row(self.client, schedule["id"])
        self.assertEqual(row["status"], "published")

    def test_delete_shift_on_published_schedule_is_blocked(self):
        _schedule, shift, _tech = self._publish_simple_schedule()
        response = self.client.delete(f"/shifts/{shift['id']}")
        self.assertEqual(response.status_code, 409, response.text)

    def test_unassign_on_published_schedule_is_blocked(self):
        schedule, shift, _tech = self._publish_simple_schedule()
        board = self.client.get(f"/schedules/{schedule['id']}")
        assignment_id = board.json()["assignments"][0]["id"]

        response = self.client.delete(
            f"/schedules/assignments/{assignment_id}"
        )
        self.assertEqual(response.status_code, 409, response.text)

    def test_reassign_on_published_schedule_is_blocked(self):
        schedule, shift, _tech = self._publish_simple_schedule()
        other_tech = self.create_technician(
            "Other Reassign Tech", "otherreassigntech@example.com"
        )
        board = self.client.get(f"/schedules/{schedule['id']}")
        assignment_id = board.json()["assignments"][0]["id"]

        response = self.client.patch(
            f"/schedules/assignments/{assignment_id}",
            json={"technician_id": other_tech["id"]},
        )
        self.assertEqual(response.status_code, 409, response.text)

    def test_create_new_assignment_on_published_schedule_is_blocked(self):
        schedule, shift, _tech = self._publish_simple_schedule()
        second_tech = self.create_technician(
            "Second Publish Tech", "secondpublishtech@example.com"
        )
        response = self.client.post(
            f"/schedules/{schedule['id']}/assignments",
            json={"shift_id": shift["id"], "technician_id": second_tech["id"]},
        )
        self.assertEqual(response.status_code, 409, response.text)

    def test_create_shift_on_published_schedule_is_blocked(self):
        schedule, _shift, _tech = self._publish_simple_schedule()
        response = self.client.post(
            "/shifts/",
            json={
                "schedule_id": schedule["id"],
                "day_of_week": "tuesday",
                "start_time": "09:00:00",
                "end_time": "12:00:00",
                "required_technicians": 1,
            },
        )
        self.assertEqual(response.status_code, 409, response.text)

    def test_generate_on_published_schedule_is_blocked(self):
        schedule, _shift, _tech = self._publish_simple_schedule()
        response = self.client.post(f"/schedules/generate/{schedule['id']}")
        self.assertEqual(response.status_code, 409, response.text)

    def test_edit_metadata_on_published_schedule_is_blocked(self):
        schedule, _shift, _tech = self._publish_simple_schedule()
        response = self.client.patch(
            f"/schedules/{schedule['id']}", json={"name": "Renamed While Live"}
        )
        self.assertEqual(response.status_code, 409, response.text)

        # The public-facing name must not have silently changed.
        row = _find_schedule_row(self.client, schedule["id"])
        self.assertEqual(row["name"], schedule["name"])


class StartEditingWorkflowTestCase(_PublishesScheduleMixin, ApiTestCase):
    def test_start_edit_creates_a_draft_clone(self):
        schedule, shift, technician = self._publish_simple_schedule()

        response = self.client.post(f"/schedules/{schedule['id']}/start-edit")
        self.assertEqual(response.status_code, 201, response.text)
        clone = response.json()

        self.assertNotEqual(clone["id"], schedule["id"])
        self.assertEqual(clone["status"], "draft")
        self.assertEqual(clone["editing_source_id"], schedule["id"])
        self.assertIsNone(clone["public_token"])

    def test_start_edit_copies_shifts_and_assignments(self):
        schedule, shift, technician = self._publish_simple_schedule()

        response = self.client.post(f"/schedules/{schedule['id']}/start-edit")
        clone = response.json()

        clone_shifts = self.client.get(
            f"/shifts/?schedule_id={clone['id']}"
        ).json()
        self.assertEqual(len(clone_shifts), 1)
        self.assertEqual(clone_shifts[0]["day_of_week"], "monday")
        # New identity, not the same row.
        self.assertNotEqual(clone_shifts[0]["id"], shift["id"])

        clone_board = self.client.get(f"/schedules/{clone['id']}")
        self.assertEqual(len(clone_board.json()["assignments"]), 1)
        self.assertEqual(
            clone_board.json()["assignments"][0]["technician_id"],
            technician["id"],
        )

    def test_original_untouched_while_clone_is_being_edited(self):
        schedule, shift, technician = self._publish_simple_schedule()
        start_edit = self.client.post(
            f"/schedules/{schedule['id']}/start-edit"
        )
        clone = start_edit.json()

        # Delete the shift on the CLONE -- the original must be unaffected.
        clone_shifts = self.client.get(
            f"/shifts/?schedule_id={clone['id']}"
        ).json()
        self.client.delete(f"/shifts/{clone_shifts[0]['id']}")

        original_shifts = self.client.get(
            f"/shifts/?schedule_id={schedule['id']}"
        ).json()
        self.assertEqual(len(original_shifts), 1)
        self.assertEqual(original_shifts[0]["id"], shift["id"])

        # Public link (unauthenticated) still serves the ORIGINAL data.
        app.dependency_overrides.pop(get_current_admin, None)
        public = self.client.get(
            f"/schedules/public/{schedule['public_token']}"
        )
        self.assertEqual(public.status_code, 200, public.text)
        self.assertEqual(len(public.json()["assignments"]), 1)
        app.dependency_overrides[get_current_admin] = (
            _override_get_current_admin
        )

    def test_start_edit_reuses_existing_in_progress_clone(self):
        schedule, _shift, _tech = self._publish_simple_schedule()

        first = self.client.post(f"/schedules/{schedule['id']}/start-edit")
        second = self.client.post(f"/schedules/{schedule['id']}/start-edit")

        self.assertEqual(first.json()["id"], second.json()["id"])

        listing = self.client.get("/schedules/")
        clone_rows = [
            row
            for row in listing.json()
            if row["editing_source_id"] == schedule["id"]
        ]
        self.assertEqual(len(clone_rows), 1)

    def test_start_edit_on_draft_schedule_is_blocked(self):
        schedule = self.create_schedule(name="Still Draft Schedule")
        response = self.client.post(f"/schedules/{schedule['id']}/start-edit")
        self.assertEqual(response.status_code, 409, response.text)

    def test_start_edit_not_found_404(self):
        response = self.client.post("/schedules/999/start-edit")
        self.assertEqual(response.status_code, 404)

    def test_start_edit_requires_admin(self):
        schedule, _shift, _tech = self._publish_simple_schedule()
        app.dependency_overrides.pop(get_current_admin, None)
        response = self.client.post(f"/schedules/{schedule['id']}/start-edit")
        self.assertIn(response.status_code, (401, 403))

    def test_abandoning_an_edit_clone_leaves_original_untouched(self):
        schedule, shift, technician = self._publish_simple_schedule()
        start_edit = self.client.post(
            f"/schedules/{schedule['id']}/start-edit"
        )
        clone = start_edit.json()

        # Abandon: just delete the draft clone instead of republishing.
        delete_response = self.client.delete(f"/schedules/{clone['id']}")
        self.assertEqual(delete_response.status_code, 204, delete_response.text)

        row = _find_schedule_row(self.client, schedule["id"])
        self.assertEqual(row["status"], "published")
        self.assertEqual(row["public_token"], schedule["public_token"])


class RepublishWorkflowTestCase(_PublishesScheduleMixin, ApiTestCase):
    def test_republish_moves_public_token_to_the_clone(self):
        schedule, shift, technician = self._publish_simple_schedule()
        original_token = schedule["public_token"]

        start_edit = self.client.post(
            f"/schedules/{schedule['id']}/start-edit"
        )
        clone = start_edit.json()

        # Make a real change on the clone: add a second technician's
        # worth of coverage by adding a new shift + assignment.
        new_shift = self.create_shift(clone["id"], "tuesday", "09:00", "12:00")
        second_tech = self.create_technician(
            "Republish Second Tech", "republishsecondtech@example.com"
        )
        self.client.post(
            f"/schedules/{clone['id']}/assignments",
            json={
                "shift_id": new_shift["id"],
                "technician_id": second_tech["id"],
            },
        )

        republish = self.client.post(f"/schedules/publish/{clone['id']}")
        self.assertEqual(republish.status_code, 200, republish.text)
        self.assertEqual(republish.json()["public_token"], original_token)

        # The SAME public link now serves the edited (2-assignment) data.
        app.dependency_overrides.pop(get_current_admin, None)
        public = self.client.get(f"/schedules/public/{original_token}")
        self.assertEqual(public.status_code, 200, public.text)
        self.assertEqual(len(public.json()["assignments"]), 2)

    def test_original_becomes_superseded_after_republish(self):
        schedule, _shift, _tech = self._publish_simple_schedule()

        start_edit = self.client.post(
            f"/schedules/{schedule['id']}/start-edit"
        )
        clone = start_edit.json()
        republish = self.client.post(f"/schedules/publish/{clone['id']}")
        self.assertEqual(republish.status_code, 200, republish.text)

        row = _find_schedule_row(self.client, schedule["id"])
        self.assertEqual(row["status"], "superseded")
        self.assertIsNone(row["public_token"])

    def test_superseded_schedule_history_is_preserved_not_deleted(self):
        schedule, shift, technician = self._publish_simple_schedule()

        start_edit = self.client.post(
            f"/schedules/{schedule['id']}/start-edit"
        )
        clone = start_edit.json()
        republish = self.client.post(f"/schedules/publish/{clone['id']}")
        self.assertEqual(republish.status_code, 200, republish.text)

        # The old row, its shift, and its assignment all still exist --
        # nothing was deleted, only superseded.
        row = _find_schedule_row(self.client, schedule["id"])
        self.assertEqual(row["id"], schedule["id"])

        original_shift = self.client.get(f"/shifts/{shift['id']}")
        self.assertEqual(original_shift.status_code, 200)

        original_board = self.client.get(f"/schedules/{schedule['id']}")
        self.assertEqual(len(original_board.json()["assignments"]), 1)

    def test_public_link_has_no_gap_between_edit_and_republish(self):
        # The whole point of the clone-to-draft approach: the public
        # link must keep serving the ORIGINAL data continuously, with
        # zero downtime, right up until the moment of republish.
        schedule, shift, technician = self._publish_simple_schedule()
        token = schedule["public_token"]

        start_edit = self.client.post(
            f"/schedules/{schedule['id']}/start-edit"
        )
        clone = start_edit.json()

        # Mutate the clone significantly (delete its only shift).
        clone_shifts = self.client.get(
            f"/shifts/?schedule_id={clone['id']}"
        ).json()
        self.client.delete(f"/shifts/{clone_shifts[0]['id']}")

        app.dependency_overrides.pop(get_current_admin, None)
        still_original = self.client.get(f"/schedules/public/{token}")
        self.assertEqual(still_original.status_code, 200, still_original.text)
        self.assertEqual(len(still_original.json()["assignments"]), 1)


if __name__ == "__main__":
    unittest.main()
