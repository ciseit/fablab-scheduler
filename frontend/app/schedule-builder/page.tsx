"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarX2,
  CheckCircle2,
  Copy,
  ExternalLink,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Users,
} from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import CreateShiftDialog, {
  type ShiftFormData,
} from "@/components/schedule-builder/CreateShiftDialog";

import { getTechnicians } from "@/lib/technicianApi";
import {
  getAvailabilityRequests,
  type AvailabilityRequestApiResponse,
} from "@/lib/availabilityRequestApi";
import {
  createShift,
  getShifts,
  type ShiftApiResponse,
  type ShiftDay,
} from "@/lib/shiftApi";
import {
  editAssignment,
  generateSchedule,
  getSchedule,
  publishSchedule,
  type ScheduleApiResponse,
} from "@/lib/scheduleApi";

type ApiTechnician = {
  id: number;
  name: string;
  email: string;
  designation: string;
  status: string;
  weekly_target_hours: number;
  notes?: string | null;
};

const DAY_LABELS: Record<ShiftDay, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const DAY_ORDER: Record<ShiftDay, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

function parseTimeParts(value: string) {
  const [hoursText, minutesText] = value.split(":");
  return {
    hours: Number(hoursText),
    minutes: Number(minutesText ?? "0"),
  };
}

function formatTime(value: string) {
  const { hours, minutes } = parseTimeParts(value);

  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = ((hours + 11) % 12) + 1;

  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

function shiftHours(start: string, end: string) {
  const startParts = parseTimeParts(start);
  const endParts = parseTimeParts(end);

  const startMinutes = startParts.hours * 60 + startParts.minutes;
  const endMinutes = endParts.hours * 60 + endParts.minutes;

  return (endMinutes - startMinutes) / 60;
}

function buildPublicScheduleUrl(publicToken: string) {
  return `${window.location.origin}/schedule/${publicToken}`;
}

export default function ScheduleBuilderPage() {
  const [campaigns, setCampaigns] = useState<
    AvailabilityRequestApiResponse[]
  >([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<
    number | null
  >(null);

  const [technicians, setTechnicians] = useState<ApiTechnician[]>([]);
  const [shifts, setShifts] = useState<ShiftApiResponse[]>([]);
  const [schedule, setSchedule] = useState<ScheduleApiResponse | null>(
    null
  );

  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [reassigningId, setReassigningId] = useState<number | null>(
    null
  );
  const [rowErrors, setRowErrors] = useState<Record<number, string>>(
    {}
  );

  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);

  useEffect(() => {
    async function loadCampaigns() {
      setLoadingCampaigns(true);
      setError("");

      try {
        const data = await getAvailabilityRequests();
        setCampaigns(data);

        const searchParams = new URLSearchParams(
          window.location.search
        );
        const campaignIdParam = searchParams.get("campaignId");
        const preselectedId = campaignIdParam
          ? Number(campaignIdParam)
          : null;

        if (
          preselectedId &&
          data.some((campaign) => campaign.id === preselectedId)
        ) {
          setSelectedCampaignId(preselectedId);
        } else if (data.length > 0) {
          setSelectedCampaignId(data[0].id);
        }
      } catch (loadError) {
        console.error(
          "Failed to load availability requests:",
          loadError
        );

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load availability requests."
        );
      } finally {
        setLoadingCampaigns(false);
      }
    }

    void loadCampaigns();
  }, []);

  async function loadScheduleData(campaignId: number) {
    setLoadingSchedule(true);
    setError("");

    try {
      const [technicianData, shiftData, scheduleData] =
        await Promise.all([
          getTechnicians(),
          getShifts(campaignId),
          getSchedule(campaignId),
        ]);

      setTechnicians(technicianData as ApiTechnician[]);
      setShifts(shiftData);
      setSchedule(scheduleData);

      // A freshly loaded schedule may reuse assignment ids from a
      // previous snapshot (e.g. after a regenerate), so any row errors
      // keyed by those ids no longer refer to the same logical row.
      setRowErrors({});
    } catch (loadError) {
      console.error("Failed to load schedule data:", loadError);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load the schedule."
      );

      setSchedule(null);
    } finally {
      setLoadingSchedule(false);
    }
  }

  useEffect(() => {
    if (selectedCampaignId !== null) {
      void loadScheduleData(selectedCampaignId);
    }
  }, [selectedCampaignId]);

  function showSuccess(message: string) {
    setSuccessMessage(message);

    window.setTimeout(() => {
      setSuccessMessage("");
    }, 2500);
  }

  const technicianById = useMemo(() => {
    const map = new Map<number, ApiTechnician>();
    technicians.forEach((technician) => {
      map.set(technician.id, technician);
    });
    return map;
  }, [technicians]);

  const shiftById = useMemo(() => {
    const map = new Map<number, ShiftApiResponse>();
    shifts.forEach((shift) => {
      map.set(shift.id, shift);
    });
    return map;
  }, [shifts]);

  const activeTechnicians = useMemo(
    () =>
      technicians.filter(
        (technician) => technician.status.toLowerCase() === "active"
      ),
    [technicians]
  );

  const assignmentRows = useMemo(() => {
    if (!schedule) {
      return [];
    }

    const rows = schedule.assignments
      .map((assignment) => {
        const shift = shiftById.get(assignment.shift_id);

        if (!shift) {
          return null;
        }

        return {
          assignment,
          shift,
          technician: technicianById.get(assignment.technician_id),
        };
      })
      .filter(
        (row): row is NonNullable<typeof row> => row !== null
      );

    rows.sort((a, b) => {
      const dayDiff =
        DAY_ORDER[a.shift.day_of_week] - DAY_ORDER[b.shift.day_of_week];

      if (dayDiff !== 0) {
        return dayDiff;
      }

      return a.shift.start_time.localeCompare(b.shift.start_time);
    });

    return rows;
  }, [schedule, shiftById, technicianById]);

  const dayGroups = useMemo(() => {
    const groups = new Map<ShiftDay, typeof assignmentRows>();

    assignmentRows.forEach((row) => {
      const day = row.shift.day_of_week;
      const existing = groups.get(day) ?? [];
      existing.push(row);
      groups.set(day, existing);
    });

    return Array.from(groups.entries())
      .sort(([dayA], [dayB]) => DAY_ORDER[dayA] - DAY_ORDER[dayB])
      .map(([day, rows]) => ({ day, rows }));
  }, [assignmentRows]);

  const belowMinimumIds = useMemo(
    () =>
      new Set(
        (schedule?.technicians_below_minimum ?? []).map(
          (entry) => entry.technician_id
        )
      ),
    [schedule]
  );

  const technicianHours = useMemo(() => {
    const hours = new Map<number, number>();

    activeTechnicians.forEach((technician) => {
      hours.set(technician.id, 0);
    });

    (schedule?.assignments ?? []).forEach((assignment) => {
      const shift = shiftById.get(assignment.shift_id);

      if (!shift) {
        return;
      }

      const current = hours.get(assignment.technician_id) ?? 0;

      hours.set(
        assignment.technician_id,
        current + shiftHours(shift.start_time, shift.end_time)
      );
    });

    return activeTechnicians
      .map((technician) => ({
        technician,
        hours: hours.get(technician.id) ?? 0,
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [activeTechnicians, schedule, shiftById]);

  const sortedShifts = useMemo(() => {
    return [...shifts].sort((a, b) => {
      const dayDiff = DAY_ORDER[a.day_of_week] - DAY_ORDER[b.day_of_week];

      if (dayDiff !== 0) {
        return dayDiff;
      }

      return a.start_time.localeCompare(b.start_time);
    });
  }, [shifts]);

  const selectedCampaign = useMemo(
    () =>
      campaigns.find(
        (campaign) => campaign.id === selectedCampaignId
      ) ?? null,
    [campaigns, selectedCampaignId]
  );

  async function handleGenerate() {
    if (selectedCampaignId === null) {
      return;
    }

    if (assignmentRows.length > 0) {
      const confirmed = window.confirm(
        "This schedule already has assignments, including any manual " +
          "reassignments you've made. Generating a new schedule will " +
          "replace all of them. Continue?"
      );

      if (!confirmed) {
        return;
      }
    }

    setGenerating(true);
    setError("");

    try {
      const result = await generateSchedule(selectedCampaignId);
      setSchedule(result);

      // Regenerating replaces every assignment row, and the new rows
      // may reuse ids from the previous schedule, so old row errors
      // must not carry over.
      setRowErrors({});

      showSuccess("Schedule generated.");
    } catch (generateError) {
      console.error("Failed to generate schedule:", generateError);

      setError(
        generateError instanceof Error
          ? generateError.message
          : "Unable to generate the schedule."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublish() {
    if (selectedCampaignId === null) {
      return;
    }

    setPublishing(true);
    setError("");

    try {
      const result = await publishSchedule(selectedCampaignId);
      setSchedule(result);
      showSuccess("Schedule published.");
    } catch (publishError) {
      console.error("Failed to publish schedule:", publishError);

      setError(
        publishError instanceof Error
          ? publishError.message
          : "Unable to publish the schedule."
      );
    } finally {
      setPublishing(false);
    }
  }

  async function handleCopyLink() {
    if (!schedule?.public_token) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        buildPublicScheduleUrl(schedule.public_token)
      );

      setLinkCopied(true);

      window.setTimeout(() => {
        setLinkCopied(false);
      }, 2000);
    } catch (copyError) {
      console.error("Failed to copy share link:", copyError);
      setError("Unable to copy the share link.");
    }
  }

  async function handleCreateShift(data: ShiftFormData) {
    if (selectedCampaignId === null) {
      return;
    }

    try {
      await createShift({
        campaign_id: selectedCampaignId,
        ...data,
      });

      setShiftDialogOpen(false);
      showSuccess("Shift created.");

      await loadScheduleData(selectedCampaignId);
    } catch (createError) {
      console.error("Failed to create shift:", createError);
      throw createError;
    }
  }

  async function handleReassign(
    assignmentId: number,
    technicianId: number
  ) {
    // Captured before the request so the error message (and the
    // rollback it describes) refers to the technicians involved in
    // *this* attempt, not whatever the row happens to render after
    // state settles.
    const previousAssignment = schedule?.assignments.find(
      (candidate) => candidate.id === assignmentId
    );
    const previousTechnicianName = previousAssignment
      ? technicianById.get(previousAssignment.technician_id)?.name
      : undefined;
    const attemptedTechnicianName =
      technicianById.get(technicianId)?.name ?? "The selected technician";

    // The dropdown itself already rolls back to the previous technician
    // on failure (we never optimistically update `schedule`), but the
    // raw backend message ("This technician has no submitted
    // availability...") reads as if it's about whichever technician the
    // row currently shows. Name both technicians explicitly so the
    // error can't be misread as applying to the (still valid) previous
    // assignment.
    const rollbackNote = previousTechnicianName
      ? ` ${previousTechnicianName} remains assigned to this shift.`
      : "";

    setReassigningId(assignmentId);

    setRowErrors((current) => {
      const next = { ...current };
      delete next[assignmentId];
      return next;
    });

    try {
      await editAssignment(assignmentId, technicianId);

      if (selectedCampaignId !== null) {
        await loadScheduleData(selectedCampaignId);
      }

      showSuccess("Assignment updated.");
    } catch (reassignError) {
      console.error("Failed to reassign shift:", reassignError);

      const baseMessage =
        reassignError instanceof Error
          ? reassignError.message
          : "Unable to reassign this shift.";

      setRowErrors((current) => ({
        ...current,
        [assignmentId]: `${attemptedTechnicianName}: ${baseMessage}${rollbackNote}`,
      }));
    } finally {
      setReassigningId(null);
    }
  }

  const hasShifts = shifts.length > 0;
  const hasAssignments = assignmentRows.length > 0;
  const uncoveredShifts = schedule?.uncovered_shifts ?? [];
  const belowMinimum = schedule?.technicians_below_minimum ?? [];
  const minimumWeeklyHours =
    schedule?.minimum_weekly_hours ?? 15;

  return (
    <AppLayout>
      <div className="space-y-8">
        <section className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-medium text-neutral-500">
                Schedule Builder
              </p>

              {schedule && (
                <span
                  className={
                    schedule.published
                      ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                      : "rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600"
                  }
                >
                  {schedule.published ? "Published" : "Not Published"}
                </span>
              )}
            </div>

            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-neutral-950">
              {selectedCampaign
                ? selectedCampaign.name
                : "Schedule Builder"}
            </h1>

            <p className="mt-3 max-w-2xl text-base text-neutral-600">
              {selectedCampaign
                ? selectedCampaign.semester ||
                  "Generate and review technician assignments for this availability request."
                : "Select an availability request to build a schedule."}
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-3">
            <select
              value={selectedCampaignId ?? ""}
              onChange={(event) =>
                setSelectedCampaignId(Number(event.target.value))
              }
              disabled={loadingCampaigns || campaigns.length === 0}
              className="h-12 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 outline-none transition focus:border-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-100"
            >
              {campaigns.length === 0 && (
                <option value="">No availability requests</option>
              )}

              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() =>
                selectedCampaignId !== null &&
                loadScheduleData(selectedCampaignId)
              }
              disabled={selectedCampaignId === null || loadingSchedule}
              className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={loadingSchedule ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={
                selectedCampaignId === null ||
                generating ||
                !hasShifts
              }
              title={
                !hasShifts
                  ? "This availability request has no shifts to schedule yet."
                  : undefined
              }
              className="flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              <Sparkles size={17} />
              {generating ? "Generating..." : "Generate Schedule"}
            </button>

            <button
              type="button"
              onClick={handlePublish}
              disabled={
                selectedCampaignId === null ||
                publishing ||
                !hasAssignments
              }
              title={
                !hasAssignments
                  ? "Generate a schedule before publishing."
                  : undefined
              }
              className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={17} />
              {publishing ? "Publishing..." : "Publish Schedule"}
            </button>
          </div>
        </section>

        {successMessage && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {schedule?.published && schedule.public_token && (
          <section className="rounded-2xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-neutral-950">
              Shareable Schedule Link
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Anyone with this link can view the published schedule.
              No administrator login is required.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <div className="flex-1 truncate rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                {buildPublicScheduleUrl(schedule.public_token)}
              </div>

              <a
                href={buildPublicScheduleUrl(schedule.public_token)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                <ExternalLink size={16} />
                View
              </a>

              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                {linkCopied ? (
                  <CheckCircle2
                    size={16}
                    className="text-emerald-600"
                  />
                ) : (
                  <Copy size={16} />
                )}
                {linkCopied ? "Copied" : "Copy Link"}
              </button>
            </div>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-sm text-neutral-500">Active technicians</p>
            <p className="mt-3 text-3xl font-semibold text-neutral-950">
              {activeTechnicians.length}
            </p>
          </article>

          <article className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-sm text-neutral-500">Total shifts</p>
            <p className="mt-3 text-3xl font-semibold text-neutral-950">
              {shifts.length}
            </p>
          </article>

          <article className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-sm text-neutral-500">Uncovered shifts</p>
            <p className="mt-3 text-3xl font-semibold text-neutral-950">
              {uncoveredShifts.length}
            </p>
          </article>

          <article className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-sm text-neutral-500">
              Below {minimumWeeklyHours} hrs
            </p>
            <p className="mt-3 text-3xl font-semibold text-neutral-950">
              {belowMinimum.length}
            </p>
          </article>
        </section>

        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold text-neutral-950">
                Coverage Shifts
              </h2>

              <p className="mt-1 text-sm text-neutral-500">
                Define the shifts technicians can be scheduled into for
                this availability request.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShiftDialogOpen(true)}
              disabled={selectedCampaignId === null}
              className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={17} />
              Add Shift
            </button>
          </div>

          {loadingSchedule ? (
            <div className="p-12 text-center text-sm text-neutral-500">
              Loading shifts...
            </div>
          ) : !hasShifts ? (
            <div className="p-12 text-center">
              <p className="font-medium text-neutral-900">
                No shifts have been created for this availability
                request yet.
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                Add a shift to define when coverage is needed, then
                generate a schedule.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-neutral-200 bg-neutral-50">
                  <tr>
                    {["Day", "Time", "Required Technicians", "Hours"].map(
                      (heading) => (
                        <th
                          key={heading}
                          className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500"
                        >
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {sortedShifts.map((shift) => (
                    <tr
                      key={shift.id}
                      className="border-b border-neutral-200 last:border-b-0"
                    >
                      <td className="px-6 py-4 font-medium text-neutral-950">
                        {DAY_LABELS[shift.day_of_week]}
                      </td>

                      <td className="px-6 py-4 text-sm text-neutral-700">
                        {formatTime(shift.start_time)} –{" "}
                        {formatTime(shift.end_time)}
                      </td>

                      <td className="px-6 py-4 text-sm text-neutral-700">
                        {shift.required_technicians}
                      </td>

                      <td className="px-6 py-4 text-sm text-neutral-500">
                        {shiftHours(shift.start_time, shift.end_time)}{" "}
                        hrs
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {uncoveredShifts.length > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <CalendarX2 size={22} />
              </div>

              <div className="flex-1">
                <h2 className="text-lg font-semibold text-neutral-950">
                  Uncovered shifts
                </h2>

                <p className="mt-1 text-sm text-neutral-600">
                  These shifts do not have enough technicians assigned.
                </p>

                <ul className="mt-4 space-y-2">
                  {uncoveredShifts.map((uncovered) => (
                    <li
                      key={uncovered.shift_id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-sm"
                    >
                      <span className="font-medium text-neutral-900">
                        {DAY_LABELS[uncovered.day_of_week]},{" "}
                        {formatTime(uncovered.start_time)} –{" "}
                        {formatTime(uncovered.end_time)}
                      </span>

                      <span className="text-amber-700">
                        {uncovered.assigned_technicians} of{" "}
                        {uncovered.required_technicians} filled ·{" "}
                        {uncovered.shortfall} needed
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {belowMinimum.length > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <AlertTriangle size={22} />
              </div>

              <div className="flex-1">
                <h2 className="text-lg font-semibold text-neutral-950">
                  Technicians Needing More Hours
                </h2>

                <p className="mt-1 text-sm text-neutral-600">
                  These technicians currently have fewer than the
                  required weekly hours ({minimumWeeklyHours} hrs for
                  this availability request).
                </p>

                <ul className="mt-4 space-y-2">
                  {belowMinimum.map((entry) => (
                    <li
                      key={entry.technician_id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-sm"
                    >
                      <span className="font-medium text-neutral-900">
                        {entry.technician_name}
                      </span>

                      <span className="text-amber-700">
                        {entry.assigned_hours} hrs assigned ·{" "}
                        {entry.shortfall_hours} hrs short
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-neutral-950">
              Draft Schedule
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Review who has been assigned to each shift before
              publishing. Assignments are grouped by day — reassign a
              shift using the technician dropdown.
            </p>
          </div>

          {loadingSchedule ? (
            <div className="p-12 text-center text-sm text-neutral-500">
              Loading schedule...
            </div>
          ) : !hasShifts ? (
            <div className="p-12 text-center">
              <p className="font-medium text-neutral-900">
                No shifts have been created for this availability
                request yet.
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                Add shifts in the Coverage Shifts section above, then
                generate a schedule.
              </p>
            </div>
          ) : !hasAssignments ? (
            <div className="p-12 text-center">
              <p className="font-medium text-neutral-900">
                No schedule generated yet
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                Click &ldquo;Generate Schedule&rdquo; to assign
                technicians to these shifts.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-200">
              {dayGroups.map(({ day, rows }) => (
                <div key={day}>
                  <div className="bg-neutral-50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {DAY_LABELS[day]}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <tbody>
                        {rows.map(({ assignment, shift, technician }) => (
                          <tr
                            key={assignment.id}
                            className="border-b border-neutral-100 last:border-b-0"
                          >
                            <td className="w-56 px-6 py-4 text-sm text-neutral-700">
                              {formatTime(shift.start_time)} –{" "}
                              {formatTime(shift.end_time)}
                            </td>

                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                <select
                                  value={assignment.technician_id}
                                  onChange={(event) =>
                                    handleReassign(
                                      assignment.id,
                                      Number(event.target.value)
                                    )
                                  }
                                  disabled={
                                    reassigningId === assignment.id
                                  }
                                  className={
                                    belowMinimumIds.has(
                                      assignment.technician_id
                                    )
                                      ? "h-10 w-full max-w-xs rounded-lg border border-amber-300 bg-amber-50 px-3 text-sm font-medium text-neutral-900 outline-none transition focus:border-neutral-950 disabled:cursor-not-allowed"
                                      : "h-10 w-full max-w-xs rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-900 outline-none transition focus:border-neutral-950 disabled:cursor-not-allowed"
                                  }
                                >
                                  {!technician && (
                                    <option value={assignment.technician_id}>
                                      Unknown technician
                                    </option>
                                  )}

                                  {activeTechnicians.map(
                                    (candidate) => (
                                      <option
                                        key={candidate.id}
                                        value={candidate.id}
                                      >
                                        {candidate.name}
                                      </option>
                                    )
                                  )}
                                </select>

                                {rowErrors[assignment.id] && (
                                  <p className="text-xs text-red-600">
                                    {rowErrors[assignment.id]}
                                  </p>
                                )}
                              </div>
                            </td>

                            <td className="px-6 py-4 text-right text-sm text-neutral-500">
                              {shiftHours(
                                shift.start_time,
                                shift.end_time
                              )}{" "}
                              hrs
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div className="flex items-center gap-3 border-b border-neutral-200 px-6 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
              <Users size={18} />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-neutral-950">
                Hours Assigned to Each Technician
              </h2>

              <p className="mt-1 text-sm text-neutral-500">
                See how many hours each technician has been assigned in
                this draft.
              </p>
            </div>
          </div>

          {technicianHours.length === 0 ? (
            <div className="p-12 text-center text-sm text-neutral-500">
              No active technicians found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-neutral-200 bg-neutral-50">
                  <tr>
                    {["Technician", "Designation", "Hours", "Status"].map(
                      (heading) => (
                        <th
                          key={heading}
                          className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500"
                        >
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {technicianHours.map(({ technician, hours }) => (
                    <tr
                      key={technician.id}
                      className="border-b border-neutral-200 last:border-b-0"
                    >
                      <td className="px-6 py-5 font-medium text-neutral-950">
                        {technician.name}
                      </td>

                      <td className="px-6 py-5 text-sm text-neutral-600">
                        {technician.designation}
                      </td>

                      <td className="px-6 py-5 text-sm text-neutral-700">
                        {hours} hrs
                      </td>

                      <td className="px-6 py-5">
                        {belowMinimumIds.has(technician.id) ? (
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                            Below {minimumWeeklyHours} hrs
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Meets minimum
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <CreateShiftDialog
        key={shiftDialogOpen ? "open" : "closed"}
        open={shiftDialogOpen}
        onClose={() => setShiftDialogOpen(false)}
        onSave={handleCreateShift}
      />
    </AppLayout>
  );
}
