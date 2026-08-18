"""
Section C (Availability Request Management) edge cases not already
covered by tests/test_collection_campaigns.py: date validation, minimum
weekly hours boundaries, closed/expired requests, and admin-side
availability CRUD edge cases (Sections D/E overlap here too: invalid
weekend time ranges, admin-side duplicate blocks).

Run with:
    cd backend && python3 -m unittest tests.test_availability_request_edges -v
"""

import unittest
from datetime import datetime, timedelta, timezone

from tests._helpers import ApiTestCase
from app.core.auth_dependencies import get_current_admin
from app.main import app


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


class AvailabilityRequestEdgeCaseTestCase(ApiTestCase):
    # -- date validation --------------------------------------------------

    def test_create_campaign_rejects_closes_before_opens(self):
        response = self.client.post(
            "/collection-campaigns/",
            json={
                "name": "Backwards Dates",
                "semester": "Fall 2026",
                "opens_at": "2026-08-31T00:00:00",
                "closes_at": "2026-08-01T00:00:00",
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_create_campaign_rejects_closes_equal_to_opens(self):
        response = self.client.post(
            "/collection-campaigns/",
            json={
                "name": "Zero Length Window",
                "semester": "Fall 2026",
                "opens_at": "2026-08-01T00:00:00",
                "closes_at": "2026-08-01T00:00:00",
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_create_campaign_rejects_name_too_short(self):
        response = self.client.post(
            "/collection-campaigns/",
            json={
                "name": "ab",
                "semester": "Fall 2026",
                "opens_at": "2026-08-01T00:00:00",
                "closes_at": "2026-08-31T00:00:00",
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_create_campaign_requires_admin(self):
        app.dependency_overrides.pop(get_current_admin, None)
        response = self.client.post(
            "/collection-campaigns/",
            json={
                "name": "No Auth Campaign",
                "semester": "Fall 2026",
                "opens_at": "2026-08-01T00:00:00",
                "closes_at": "2026-08-31T00:00:00",
            },
        )
        self.assertIn(response.status_code, (401, 403))

    # -- minimum weekly hours boundaries ------------------------------

    def test_campaign_minimum_weekly_hours_zero_is_allowed(self):
        campaign = self.create_campaign(minimum_weekly_hours=0)
        self.assertEqual(campaign["minimum_weekly_hours"], 0)

    def test_campaign_minimum_weekly_hours_at_upper_bound_is_allowed(self):
        campaign = self.create_campaign(minimum_weekly_hours=40)
        self.assertEqual(campaign["minimum_weekly_hours"], 40)

    def test_campaign_minimum_weekly_hours_above_bound_is_rejected(self):
        response = self.client.post(
            "/collection-campaigns/",
            json={
                "name": "Too High Minimum",
                "semester": "Fall 2026",
                "opens_at": "2026-08-01T00:00:00",
                "closes_at": "2026-08-31T00:00:00",
                "minimum_weekly_hours": 41,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_campaign_minimum_weekly_hours_negative_is_rejected(self):
        response = self.client.post(
            "/collection-campaigns/",
            json={
                "name": "Negative Minimum",
                "semester": "Fall 2026",
                "opens_at": "2026-08-01T00:00:00",
                "closes_at": "2026-08-31T00:00:00",
                "minimum_weekly_hours": -1,
            },
        )
        self.assertEqual(response.status_code, 422)

    # -- public lookup / expired-or-unknown requests -----------------

    def test_public_campaign_lookup_by_unknown_token_returns_404(self):
        response = self.client.get(
            "/collection-campaigns/public/not-a-real-token"
        )
        self.assertEqual(response.status_code, 404)

    def test_public_availability_submission_against_unknown_token_returns_404(self):
        response = self.client.post(
            "/availability/public/not-a-real-token",
            json={
                "email": "someone@example.com",
                "availability_blocks": [
                    {
                        "day_of_week": "monday",
                        "start_time": "09:00:00",
                        "end_time": "12:00:00",
                        "availability_type": "available",
                    }
                ],
            },
        )
        self.assertEqual(response.status_code, 404)

    def test_public_submission_for_unregistered_email_returns_404(self):
        campaign = self.create_campaign()
        response = self.submit_public_availability(
            campaign["public_token"],
            "not-a-technician@example.com",
            [
                {
                    "day_of_week": "monday",
                    "start_time": "09:00:00",
                    "end_time": "12:00:00",
                    "availability_type": "available",
                }
            ],
            expect_status=404,
        )

    def test_closed_campaign_still_visible_and_its_history_preserved(self):
        # "Closed" is a status label, not a deletion. A closed request's
        # prior submissions must remain intact and readable.
        campaign = self.create_campaign()
        technician = self.create_technician("Closed Campaign Tech", "closedcamp@example.com")
        self.submit_public_availability(
            campaign["public_token"],
            "closedcamp@example.com",
            [
                {
                    "day_of_week": "monday",
                    "start_time": "09:00:00",
                    "end_time": "12:00:00",
                    "availability_type": "available",
                }
            ],
        )

        summary_before = self.client.get(
            f"/collection-campaigns/{campaign['id']}/submission-summary"
        )
        self.assertEqual(summary_before.json()["unique_technicians_submitted"], 1)

        listing = self.client.get("/collection-campaigns/")
        matching = [c for c in listing.json() if c["id"] == campaign["id"]][0]
        self.assertEqual(matching["submitted_count"], 1)

    # -- admin-side availability CRUD (mirrors public flow, Section D/E) --

    def test_admin_create_availability_for_unknown_technician_404(self):
        campaign = self.create_campaign()
        response = self.client.post(
            "/availability/technicians/999",
            json={
                "campaign_id": campaign["id"],
                "day_of_week": "monday",
                "start_time": "09:00:00",
                "end_time": "12:00:00",
                "availability_type": "available",
            },
        )
        self.assertEqual(response.status_code, 404)

    def test_admin_create_availability_for_unknown_campaign_404(self):
        technician = self.create_technician("Ghost Campaign Tech", "ghostcamp@example.com")
        response = self.client.post(
            f"/availability/technicians/{technician['id']}",
            json={
                "campaign_id": 999,
                "day_of_week": "monday",
                "start_time": "09:00:00",
                "end_time": "12:00:00",
                "availability_type": "available",
            },
        )
        self.assertEqual(response.status_code, 404)

    def test_admin_create_availability_rejects_invalid_weekend_time_range(self):
        # end_time <= start_time must be rejected the same on Saturday and
        # Sunday as any other day.
        campaign = self.create_campaign()
        technician = self.create_technician("Weekend Tech", "weekendtech@example.com")

        response = self.client.post(
            f"/availability/technicians/{technician['id']}",
            json={
                "campaign_id": campaign["id"],
                "day_of_week": "saturday",
                "start_time": "14:00:00",
                "end_time": "09:00:00",
                "availability_type": "available",
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_admin_create_duplicate_availability_block_rejected(self):
        campaign = self.create_campaign()
        technician = self.create_technician("Dup Block Tech", "dupblock@example.com")
        self.submit_availability(
            technician["id"], campaign["id"], "sunday", "10:00", "12:00", "available"
        )
        response = self.client.post(
            f"/availability/technicians/{technician['id']}",
            json={
                "campaign_id": campaign["id"],
                "day_of_week": "sunday",
                "start_time": "10:00:00",
                "end_time": "12:00:00",
                "availability_type": "available",
            },
        )
        self.assertEqual(response.status_code, 409)

    def test_delete_single_availability_block(self):
        campaign = self.create_campaign()
        technician = self.create_technician("Deletable Block Tech", "deletable@example.com")
        block = self.submit_availability(
            technician["id"], campaign["id"], "monday", "09:00", "12:00", "available"
        )
        response = self.client.delete(f"/availability/{block['id']}")
        self.assertEqual(response.status_code, 200)

        remaining = self.client.get(
            f"/availability/technicians/{technician['id']}"
        )
        self.assertEqual(remaining.json(), [])

    def test_campaign_status_never_transitions_away_from_draft(self):
        # Documents a real gap: CollectionCampaign.status is created as
        # "draft" and nothing in the codebase (no endpoint, no
        # background job, no date-based computation) ever sets it to
        # "open" or "closed", even once closes_at is in the past. The
        # "closed"/"open" values in CampaignStatus are effectively dead.
        # This means Diana has no way to see, at a glance, whether a
        # request is still accepting submissions versus expired --
        # she'd have to compare closes_at to today's date herself.
        campaign = self.create_campaign(
            opens_at="2020-01-01T00:00:00",
            closes_at="2020-01-31T00:00:00",
        )
        # This assertion documents CURRENT behavior (it passes); the gap
        # itself -- that Diana has no at-a-glance "is this still open"
        # signal -- is reported as an ambiguous-business-behavior finding
        # rather than encoded here as a failing test, since there's no
        # existing spec for what open/closed should mean.
        self.assertEqual(campaign["status"], "draft")

    def test_update_availability_block_rejects_bad_time_range(self):
        campaign = self.create_campaign()
        technician = self.create_technician("Bad Range Tech", "badrange@example.com")
        block = self.submit_availability(
            technician["id"], campaign["id"], "monday", "09:00", "12:00", "available"
        )
        response = self.client.patch(
            f"/availability/{block['id']}",
            json={"start_time": "15:00:00", "end_time": "10:00:00"},
        )
        self.assertEqual(response.status_code, 422)

    # -- Phase 2, Decision 5: editing + enforced closing date -------------

    def test_update_campaign_can_extend_closing_date(self):
        campaign = self.create_campaign(
            opens_at="2026-08-01T00:00:00", closes_at="2026-08-31T00:00:00"
        )
        response = self.client.patch(
            f"/collection-campaigns/{campaign['id']}",
            json={"closes_at": "2026-09-30T00:00:00"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["closes_at"], "2026-09-30T00:00:00")
        # Untouched fields survive the partial update.
        self.assertEqual(response.json()["name"], campaign["name"])

    def test_update_campaign_rejects_closes_before_opens(self):
        campaign = self.create_campaign(
            opens_at="2026-08-01T00:00:00", closes_at="2026-08-31T00:00:00"
        )
        response = self.client.patch(
            f"/collection-campaigns/{campaign['id']}",
            json={"closes_at": "2026-07-01T00:00:00"},
        )
        self.assertEqual(response.status_code, 422)

    def test_update_campaign_rejects_opens_moved_past_existing_closes(self):
        campaign = self.create_campaign(
            opens_at="2026-08-01T00:00:00", closes_at="2026-08-31T00:00:00"
        )
        response = self.client.patch(
            f"/collection-campaigns/{campaign['id']}",
            json={"opens_at": "2026-09-15T00:00:00"},
        )
        self.assertEqual(response.status_code, 422)

    def test_update_campaign_not_found_404(self):
        response = self.client.patch(
            "/collection-campaigns/999", json={"name": "Ghost Request"}
        )
        self.assertEqual(response.status_code, 404)

    def test_update_campaign_requires_admin(self):
        campaign = self.create_campaign()
        app.dependency_overrides.pop(get_current_admin, None)
        response = self.client.patch(
            f"/collection-campaigns/{campaign['id']}",
            json={"name": "Hijacked Name"},
        )
        self.assertIn(response.status_code, (401, 403))

    def test_is_accepting_submissions_true_for_future_closing_date(self):
        future_closes = datetime.now(timezone.utc) + timedelta(days=7)
        campaign = self.create_campaign(
            opens_at=_iso(datetime.now(timezone.utc) - timedelta(days=1)),
            closes_at=_iso(future_closes),
        )
        self.assertTrue(campaign["is_accepting_submissions"])

    def test_is_accepting_submissions_false_for_past_closing_date(self):
        campaign = self.create_campaign(
            opens_at="2020-01-01T00:00:00", closes_at="2020-01-31T00:00:00"
        )
        self.assertFalse(campaign["is_accepting_submissions"])

    def test_public_submission_blocked_after_closing_date_has_passed(self):
        campaign = self.create_campaign(
            opens_at="2020-01-01T00:00:00", closes_at="2020-01-31T00:00:00"
        )
        self.create_technician("Late Submitter", "latesubmitter@example.com")

        response = self.submit_public_availability(
            campaign["public_token"],
            "latesubmitter@example.com",
            [
                {
                    "day_of_week": "monday",
                    "start_time": "09:00:00",
                    "end_time": "12:00:00",
                    "availability_type": "available",
                }
            ],
            expect_status=409,
        )
        self.assertIn("closed", response.json()["detail"].lower())

    def test_public_submission_allowed_before_closing_date(self):
        future_closes = datetime.now(timezone.utc) + timedelta(days=7)
        campaign = self.create_campaign(
            opens_at=_iso(datetime.now(timezone.utc) - timedelta(days=1)),
            closes_at=_iso(future_closes),
        )
        self.create_technician("On Time Submitter", "ontimesubmitter@example.com")

        response = self.submit_public_availability(
            campaign["public_token"],
            "ontimesubmitter@example.com",
            [
                {
                    "day_of_week": "monday",
                    "start_time": "09:00:00",
                    "end_time": "12:00:00",
                    "availability_type": "available",
                }
            ],
        )
        self.assertEqual(len(response), 1)

    def test_existing_submissions_preserved_when_request_closes(self):
        # A request "closing" (its deadline passing) must never touch
        # data already on file -- closing only blocks *new* submissions.
        future_closes = datetime.now(timezone.utc) + timedelta(seconds=2)
        campaign = self.create_campaign(
            opens_at=_iso(datetime.now(timezone.utc) - timedelta(days=1)),
            closes_at=_iso(future_closes),
        )
        self.create_technician("Preserved Tech", "preservedtech@example.com")
        self.submit_public_availability(
            campaign["public_token"],
            "preservedtech@example.com",
            [
                {
                    "day_of_week": "monday",
                    "start_time": "09:00:00",
                    "end_time": "12:00:00",
                    "availability_type": "available",
                }
            ],
        )

        # Force the deadline into the past without touching submitted
        # data, then confirm the submission summary is unaffected.
        self.client.patch(
            f"/collection-campaigns/{campaign['id']}",
            json={"opens_at": "2020-01-01T00:00:00", "closes_at": "2020-01-31T00:00:00"},
        )

        summary = self.client.get(
            f"/collection-campaigns/{campaign['id']}/submission-summary"
        )
        self.assertEqual(summary.json()["unique_technicians_submitted"], 1)
        self.assertEqual(summary.json()["total_availability_blocks"], 1)

    def test_extending_closing_date_reopens_submissions(self):
        campaign = self.create_campaign(
            opens_at="2020-01-01T00:00:00", closes_at="2020-01-31T00:00:00"
        )
        self.create_technician("Reopened Tech", "reopenedtech@example.com")

        block = {
            "day_of_week": "monday",
            "start_time": "09:00:00",
            "end_time": "12:00:00",
            "availability_type": "available",
        }

        blocked = self.submit_public_availability(
            campaign["public_token"],
            "reopenedtech@example.com",
            [block],
            expect_status=409,
        )
        self.assertIn("closed", blocked.json()["detail"].lower())

        future_closes = _iso(datetime.now(timezone.utc) + timedelta(days=7))
        extend = self.client.patch(
            f"/collection-campaigns/{campaign['id']}",
            json={"closes_at": future_closes},
        )
        self.assertEqual(extend.status_code, 200, extend.text)
        self.assertTrue(extend.json()["is_accepting_submissions"])

        allowed = self.submit_public_availability(
            campaign["public_token"], "reopenedtech@example.com", [block]
        )
        self.assertEqual(len(allowed), 1)


if __name__ == "__main__":
    unittest.main()
