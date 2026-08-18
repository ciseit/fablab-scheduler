"""
Section H (Shift Management), Section I (Assignments), and Section Q
(Delete/Archive Audit) gaps not already covered by tests/test_scheduling.py:
missing delete/unassign endpoints, zero-length/overlapping shift handling,
multiple shifts per day, and weekend-specific shift/assignment behavior.

Run with:
    cd backend && python3 -m unittest tests.test_shift_assignment_gaps -v
"""

import unittest

from tests._helpers import ApiTestCase


class ShiftManagementTestCase(ApiTestCase):
    def test_create_shift_zero_length_rejected(self):
        schedule = self.create_schedule(name="Zero Length Schedule")
        response = self.client.post(
            "/shifts/",
            json={
                "schedule_id": schedule["id"],
                "day_of_week": "monday",
                "start_time": "09:00:00",
                "end_time": "09:00:00",
                "required_technicians": 1,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_create_shift_end_before_start_rejected(self):
        schedule = self.create_schedule(name="Backwards Shift Schedule")
        response = self.client.post(
            "/shifts/",
            json={
                "schedule_id": schedule["id"],
                "day_of_week": "monday",
                "start_time": "14:00:00",
                "end_time": "09:00:00",
                "required_technicians": 1,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_create_shift_for_unknown_schedule_404(self):
        response = self.client.post(
            "/shifts/",
            json={
                "schedule_id": 999,
                "day_of_week": "monday",
                "start_time": "09:00:00",
                "end_time": "12:00:00",
                "required_technicians": 1,
            },
        )
        self.assertEqual(response.status_code, 404)

    def test_create_shift_required_technicians_zero_rejected(self):
        schedule = self.create_schedule(name="Zero Required Schedule")
        response = self.client.post(
            "/shifts/",
            json={
                "schedule_id": schedule["id"],
                "day_of_week": "monday",
                "start_time": "09:00:00",
                "end_time": "12:00:00",
                "required_technicians": 0,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_two_overlapping_shifts_can_both_be_created(self):
        # Creating overlapping shifts on the same schedule is allowed --
        # the overlap constraint is enforced at assignment time (one
        # technician can't work both), not at shift-creation time. This
        # documents that intentional behavior.
        schedule = self.create_schedule(name="Overlap Creation Schedule")
        first = self.create_shift(schedule["id"], "monday", "09:00", "12:00")
        second = self.create_shift(schedule["id"], "monday", "10:00", "13:00")
        self.assertNotEqual(first["id"], second["id"])

    def test_multiple_shifts_same_day_are_all_listed(self):
        schedule = self.create_schedule(name="Multi Shift Day Schedule")
        self.create_shift(schedule["id"], "monday", "08:00", "10:00")
        self.create_shift(schedule["id"], "monday", "10:00", "12:00")
        self.create_shift(schedule["id"], "monday", "12:00", "14:00")

        response = self.client.get(
            f"/shifts/?schedule_id={schedule['id']}"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 3)

    def test_saturday_shift_can_be_created(self):
        schedule = self.create_schedule(name="Saturday Shift Schedule")
        shift = self.create_shift(schedule["id"], "saturday", "10:00", "14:00")
        self.assertEqual(shift["day_of_week"], "saturday")

    def test_sunday_shift_can_be_created(self):
        schedule = self.create_schedule(name="Sunday Shift Schedule")
        shift = self.create_shift(schedule["id"], "sunday", "10:00", "14:00")
        self.assertEqual(shift["day_of_week"], "sunday")

    def test_get_shift_not_found_404(self):
        response = self.client.get("/shifts/999")
        self.assertEqual(response.status_code, 404)

    def test_unassigned_shift_appears_in_uncovered_list_on_board(self):
        schedule = self.create_schedule(name="Unassigned Shift Schedule")
        shift = self.create_shift(
            schedule["id"], "monday", "09:00", "12:00", required_technicians=2
        )

        board = self.client.get(f"/schedules/{schedule['id']}")
        self.assertEqual(board.status_code, 200)
        uncovered_ids = [
            item["shift_id"] for item in board.json()["uncovered_shifts"]
        ]
        self.assertIn(shift["id"], uncovered_ids)
        self.assertEqual(
            board.json()["uncovered_shifts"][0]["shortfall"], 2
        )

    def test_delete_shift_on_draft_schedule_succeeds(self):
        # Phase 2, Decision 3: draft schedules/shifts can now be deleted
        # directly. Deep coverage (published-schedule protection, the
        # edit-copy/republish workflow) lives in
        # test_published_schedule_editing.py.
        schedule = self.create_schedule(name="Delete Shift Schedule")
        shift = self.create_shift(schedule["id"], "monday", "09:00", "12:00")
        response = self.client.delete(f"/shifts/{shift['id']}")
        self.assertEqual(response.status_code, 204, response.text)

        get_response = self.client.get(f"/shifts/{shift['id']}")
        self.assertEqual(get_response.status_code, 404)

    def test_delete_shift_cascades_its_assignments(self):
        schedule = self.create_schedule(name="Cascade Delete Shift Schedule")
        shift = self.create_shift(schedule["id"], "monday", "09:00", "12:00")
        technician = self.create_technician(
            "Cascade Delete Tech", "cascadedeletetech@example.com"
        )
        self.client.post(
            f"/schedules/{schedule['id']}/assignments",
            json={"shift_id": shift["id"], "technician_id": technician["id"]},
        )

        response = self.client.delete(f"/shifts/{shift['id']}")
        self.assertEqual(response.status_code, 204, response.text)

        board = self.client.get(f"/schedules/{schedule['id']}")
        self.assertEqual(board.json()["assignments"], [])

    def test_delete_shift_not_found_404(self):
        response = self.client.delete("/shifts/999")
        self.assertEqual(response.status_code, 404)

    def test_delete_draft_schedule_succeeds(self):
        schedule = self.create_schedule(name="Delete Draft Schedule")
        response = self.client.delete(f"/schedules/{schedule['id']}")
        self.assertEqual(response.status_code, 204, response.text)

        get_response = self.client.get(f"/schedules/{schedule['id']}")
        self.assertEqual(get_response.status_code, 404)

    def test_delete_draft_schedule_cascades_shifts_and_assignments(self):
        schedule = self.create_schedule(name="Cascade Delete Schedule")
        shift = self.create_shift(schedule["id"], "monday", "09:00", "12:00")
        technician = self.create_technician(
            "Cascade Schedule Tech", "cascadescheduletech@example.com"
        )
        self.client.post(
            f"/schedules/{schedule['id']}/assignments",
            json={"shift_id": shift["id"], "technician_id": technician["id"]},
        )

        response = self.client.delete(f"/schedules/{schedule['id']}")
        self.assertEqual(response.status_code, 204, response.text)

        shift_response = self.client.get(f"/shifts/{shift['id']}")
        self.assertEqual(shift_response.status_code, 404)

    def test_delete_schedule_not_found_404(self):
        response = self.client.delete("/schedules/999")
        self.assertEqual(response.status_code, 404)

    def test_delete_shift_requires_admin(self):
        from app.core.auth_dependencies import get_current_admin
        from app.main import app

        schedule = self.create_schedule(name="Delete Shift Auth Schedule")
        shift = self.create_shift(schedule["id"], "monday", "09:00", "12:00")

        app.dependency_overrides.pop(get_current_admin, None)
        response = self.client.delete(f"/shifts/{shift['id']}")
        self.assertIn(response.status_code, (401, 403))

    def test_delete_schedule_requires_admin(self):
        from app.core.auth_dependencies import get_current_admin
        from app.main import app

        schedule = self.create_schedule(name="Delete Schedule Auth Schedule")

        app.dependency_overrides.pop(get_current_admin, None)
        response = self.client.delete(f"/schedules/{schedule['id']}")
        self.assertIn(response.status_code, (401, 403))


class AssignmentTestCase(ApiTestCase):
    def test_manual_assignment_to_available_technician_succeeds(self):
        campaign = self.create_campaign()
        technician = self.create_technician("Available Tech", "available@example.com")
        self.submit_availability(
            technician["id"], campaign["id"], "monday", "08:00", "12:00", "available"
        )
        schedule = self.create_schedule(campaign_id=campaign["id"])
        shift = self.create_shift(schedule["id"], "monday", "08:00", "12:00")

        response = self.client.post(
            f"/schedules/{schedule['id']}/assignments",
            json={"shift_id": shift["id"], "technician_id": technician["id"]},
        )
        self.assertEqual(response.status_code, 201, response.text)

    def test_manual_assignment_to_unavailable_technician_on_linked_schedule_rejected(
        self,
    ):
        campaign = self.create_campaign()
        technician = self.create_technician("No Availability Tech", "noavail@example.com")
        schedule = self.create_schedule(campaign_id=campaign["id"])
        shift = self.create_shift(schedule["id"], "monday", "08:00", "12:00")

        response = self.client.post(
            f"/schedules/{schedule['id']}/assignments",
            json={"shift_id": shift["id"], "technician_id": technician["id"]},
        )
        self.assertEqual(response.status_code, 422, response.text)

    def test_overlapping_assignment_for_same_technician_rejected(self):
        campaign = self.create_campaign()
        technician = self.create_technician("Overlap Tech", "overlap@example.com")
        self.submit_availability(
            technician["id"], campaign["id"], "monday", "08:00", "14:00", "available"
        )
        schedule = self.create_schedule(campaign_id=campaign["id"])
        shift_a = self.create_shift(schedule["id"], "monday", "08:00", "11:00")
        shift_b = self.create_shift(schedule["id"], "monday", "10:00", "13:00")

        first = self.client.post(
            f"/schedules/{schedule['id']}/assignments",
            json={"shift_id": shift_a["id"], "technician_id": technician["id"]},
        )
        self.assertEqual(first.status_code, 201, first.text)

        second = self.client.post(
            f"/schedules/{schedule['id']}/assignments",
            json={"shift_id": shift_b["id"], "technician_id": technician["id"]},
        )
        self.assertEqual(second.status_code, 409)

    def test_original_assignment_preserved_after_rejected_reassignment(self):
        campaign = self.create_campaign()
        holder = self.create_technician("Original Holder", "holder@example.com")
        blocked = self.create_technician("Blocked Tech", "blocked@example.com")

        self.submit_availability(
            holder["id"], campaign["id"], "monday", "08:00", "12:00", "available"
        )
        # `blocked` has no submitted availability for this campaign at all.

        schedule = self.create_schedule(campaign_id=campaign["id"])
        shift = self.create_shift(schedule["id"], "monday", "08:00", "12:00")

        created = self.client.post(
            f"/schedules/{schedule['id']}/assignments",
            json={"shift_id": shift["id"], "technician_id": holder["id"]},
        )
        self.assertEqual(created.status_code, 201, created.text)
        assignment_id = created.json()["id"]

        reassign = self.client.patch(
            f"/schedules/assignments/{assignment_id}",
            json={"technician_id": blocked["id"]},
        )
        self.assertEqual(reassign.status_code, 422, reassign.text)

        board = self.client.get(f"/schedules/{schedule['id']}")
        assignment = board.json()["assignments"][0]
        self.assertEqual(assignment["technician_id"], holder["id"])

    def test_duplicate_assignment_for_same_shift_and_technician_rejected(self):
        schedule = self.create_schedule(name="Dup Assign Schedule")
        shift = self.create_shift(schedule["id"], "monday", "09:00", "12:00")
        technician = self.create_technician("Dup Assign Tech", "dupassign@example.com")

        first = self.client.post(
            f"/schedules/{schedule['id']}/assignments",
            json={"shift_id": shift["id"], "technician_id": technician["id"]},
        )
        self.assertEqual(first.status_code, 201, first.text)

        second = self.client.post(
            f"/schedules/{schedule['id']}/assignments",
            json={"shift_id": shift["id"], "technician_id": technician["id"]},
        )
        self.assertEqual(second.status_code, 409)

    def test_multiple_technicians_can_fill_a_multi_slot_shift(self):
        schedule = self.create_schedule(name="Multi Slot Schedule")
        shift = self.create_shift(
            schedule["id"], "monday", "09:00", "12:00", required_technicians=2
        )
        tech_a = self.create_technician("Slot A", "slota@example.com")
        tech_b = self.create_technician("Slot B", "slotb@example.com")

        for tech in (tech_a, tech_b):
            response = self.client.post(
                f"/schedules/{schedule['id']}/assignments",
                json={"shift_id": shift["id"], "technician_id": tech["id"]},
            )
            self.assertEqual(response.status_code, 201, response.text)

        board = self.client.get(f"/schedules/{schedule['id']}")
        self.assertEqual(len(board.json()["assignments"]), 2)
        self.assertEqual(board.json()["uncovered_shifts"], [])

    def test_assignment_for_unknown_shift_on_schedule_404(self):
        schedule = self.create_schedule(name="Unknown Shift Schedule")
        technician = self.create_technician("Unknown Shift Tech", "unkshift@example.com")

        response = self.client.post(
            f"/schedules/{schedule['id']}/assignments",
            json={"shift_id": 999, "technician_id": technician["id"]},
        )
        self.assertEqual(response.status_code, 404)

    def test_assignment_for_unknown_technician_404(self):
        schedule = self.create_schedule(name="Unknown Tech Schedule")
        shift = self.create_shift(schedule["id"], "monday", "09:00", "12:00")

        response = self.client.post(
            f"/schedules/{schedule['id']}/assignments",
            json={"shift_id": shift["id"], "technician_id": 999},
        )
        self.assertEqual(response.status_code, 404)

    def test_unassign_removes_the_assignment(self):
        # Phase 2, Decision 3: draft-schedule assignments can now be
        # unassigned directly.
        schedule = self.create_schedule(name="Unassign Schedule")
        shift = self.create_shift(schedule["id"], "monday", "09:00", "12:00")
        technician = self.create_technician("Unassign Tech", "unassigntech@example.com")

        created = self.client.post(
            f"/schedules/{schedule['id']}/assignments",
            json={"shift_id": shift["id"], "technician_id": technician["id"]},
        )
        assignment_id = created.json()["id"]

        response = self.client.delete(
            f"/schedules/assignments/{assignment_id}"
        )
        self.assertEqual(response.status_code, 204, response.text)

        board = self.client.get(f"/schedules/{schedule['id']}")
        self.assertEqual(board.json()["assignments"], [])
        self.assertEqual(len(board.json()["uncovered_shifts"]), 1)

    def test_unassign_not_found_404(self):
        response = self.client.delete("/schedules/assignments/999")
        self.assertEqual(response.status_code, 404)

    def test_unassign_requires_admin(self):
        from app.core.auth_dependencies import get_current_admin
        from app.main import app

        schedule = self.create_schedule(name="Unassign Auth Schedule")
        shift = self.create_shift(schedule["id"], "monday", "09:00", "12:00")
        technician = self.create_technician(
            "Unassign Auth Tech", "unassignauthtech@example.com"
        )
        created = self.client.post(
            f"/schedules/{schedule['id']}/assignments",
            json={"shift_id": shift["id"], "technician_id": technician["id"]},
        )
        assignment_id = created.json()["id"]

        app.dependency_overrides.pop(get_current_admin, None)
        response = self.client.delete(
            f"/schedules/assignments/{assignment_id}"
        )
        self.assertIn(response.status_code, (401, 403))


class WeekendGenerationTestCase(ApiTestCase):
    def test_weekend_only_technician_gets_weekend_shift_on_generation(self):
        campaign = self.create_campaign()
        weekend_tech = self.create_technician(
            "Weekend Only Tech", "weekendonly@example.com"
        )
        self.submit_availability(
            weekend_tech["id"], campaign["id"], "saturday", "10:00", "14:00", "available"
        )

        schedule = self.create_schedule(campaign_id=campaign["id"])
        self.create_shift(schedule["id"], "saturday", "10:00", "14:00")

        response = self.client.post(f"/schedules/generate/{schedule['id']}")
        self.assertEqual(response.status_code, 201, response.text)
        assignments = response.json()["assignments"]
        self.assertEqual(len(assignments), 1)
        self.assertEqual(assignments[0]["technician_id"], weekend_tech["id"])

    def test_weekday_and_weekend_technician_covers_both(self):
        campaign = self.create_campaign()
        flexible_tech = self.create_technician(
            "Flexible Tech", "flexible@example.com"
        )
        self.submit_availability(
            flexible_tech["id"], campaign["id"], "monday", "09:00", "12:00", "available"
        )
        self.submit_availability(
            flexible_tech["id"], campaign["id"], "sunday", "09:00", "12:00", "available"
        )

        schedule = self.create_schedule(campaign_id=campaign["id"])
        self.create_shift(schedule["id"], "monday", "09:00", "12:00")
        self.create_shift(schedule["id"], "sunday", "09:00", "12:00")

        response = self.client.post(f"/schedules/generate/{schedule['id']}")
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(len(response.json()["assignments"]), 2)
        self.assertEqual(response.json()["uncovered_shifts"], [])

    def test_generation_with_no_active_technicians_leaves_shift_uncovered(self):
        campaign = self.create_campaign()
        schedule = self.create_schedule(campaign_id=campaign["id"])
        self.create_shift(schedule["id"], "monday", "09:00", "12:00")

        response = self.client.post(f"/schedules/generate/{schedule['id']}")
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["assignments"], [])
        self.assertEqual(len(response.json()["uncovered_shifts"]), 1)


if __name__ == "__main__":
    unittest.main()
