"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarX2,
  CheckCircle2,
  Copy,
  ExternalLink,
  Filter,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import CreateShiftDialog, {
  type ShiftFormData,
} from "@/components/schedule-builder/CreateShiftDialog";
import CreateScheduleDialog from "@/components/schedule-builder/CreateScheduleDialog";

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
  createAssignment,
  createSchedule,
  editAssignment,
  generateSchedule,
  getScheduleBoard,
  getSchedules,
  publishSchedule,
  type CreateSchedulePayload,
  type ScheduleBoardApiResponse,
  type ScheduleListApiResponse,
} from "@/lib/scheduleApi";
import { getLocations, type LocationApiResponse } from "@/lib/locationApi";
import {
  getScheduleCategories,
  type ScheduleCategoryApiResponse,
} from "@/lib/scheduleCategoryApi";

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
  const [schedules, setSchedules] = useState<ScheduleListApiResponse[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<
    number | null
  >(null);

  const [availabilityRequests, setAvailabilityRequests] = useState<
    AvailabilityRequestApiResponse[]
  >([]);

  const [technicians, setTechnicians] = useState<ApiTechnician[]>([]);
  const [shifts, setShifts] = useState<ShiftApiResponse[]>([]);
  const [locations, setLocations] = useState<LocationApiResponse[]>([]);
  const [categories, setCategories] = useState<
    ScheduleCategoryApiResponse[]
  >([]);
  const [board, setBoard] = useState<ScheduleBoardApiResponse | null>(
    null
  );

  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [loadingBoard, setLoadingBoard] = useState(false);
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

  const [assigningShiftId, setAssigningShiftId] = useState<
    number | null
  >(null);
  const [assignPickerTechnicianId, setAssignPickerTechnicianId] =
    useState<number | "">("");
  const [assigningInProgress, setAssigningInProgress] = useState(false);

  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

  const [filterTechnicianId, setFilterTechnicianId] = useState<
    number | ""
  >("");
  const [filterLocationId, setFilterLocationId] = useState<number | "">(
    ""
  );
  const [filterDay, setFilterDay] = useState<ShiftDay | "">("");
  const [filterCategoryId, setFilterCategoryId] = useState<
    number | ""
  >("");

  async function loadStaticData() {
    setLoadingSchedules(true);
    setError("");

    try {
      const [scheduleData, requestData, technicianData, locationData, categoryData] =
        await Promise.all([
          getSchedules(),
          getAvailabilityRequests(),
          getTechnicians(),
          getLocations(),
          getScheduleCategories(),
        ]);

      setSchedules(scheduleData);
      setAvailabilityRequests(requestData);
      setTechnicians(technicianData as ApiTechnician[]);
      setLocations(locationData);
      setCategories(categoryData);

      const searchParams = new URLSearchParams(window.location.search);
      const scheduleIdParam = searchParams.get("scheduleId");
      const campaignIdParam = searchParams.get("campaignId");

      const preselectedById = scheduleIdParam
        ? scheduleData.find(
            (candidate) => candidate.id === Number(scheduleIdParam)
          )
        : null;

      const preselectedByCampaign = campaignIdParam
        ? scheduleData.find(
            (candidate) => candidate.campaign_id === Number(campaignIdParam)
          )
        : null;

      const preselected =
        preselectedById ?? preselectedByCampaign ?? scheduleData[0] ?? null;

      if (preselected) {
        setSelectedScheduleId(preselected.id);
      }
    } catch (loadError) {
      console.error("Failed to load schedule builder data:", loadError);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load schedules."
      );
    } finally {
      setLoadingSchedules(false);
    }
  }

  useEffect(() => {
    void loadStaticData();
  }, []);

  async function loadScheduleData(scheduleId: number) {
    setLoadingBoard(true);
    setError("");

    try {
      const [shiftData, boardData] = await Promise.all([
        getShifts(scheduleId),
        getScheduleBoard(scheduleId),
      ]);

      setShifts(shiftData);
      setBoard(boardData);

      // A freshly loaded board may reuse assignment ids from a previous
      // snapshot (e.g. after a regenerate), so any row errors keyed by
      // those ids no longer refer to the same logical row.
      setRowErrors({});
    } catch (loadError) {
      console.error("Failed to load schedule data:", loadError);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load the schedule."
      );

      setBoard(null);
    } finally {
      setLoadingBoard(false);
    }
  }

  useEffect(() => {
    if (selectedScheduleId !== null) {
      void loadScheduleData(selectedScheduleId);
    } else {
      setShifts([]);
      setBoard(null);
    }
  }, [selectedScheduleId]);

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

  const locationById = useMemo(() => {
    const map = new Map<number, LocationApiResponse>();
    locations.forEach((location) => {
      map.set(location.id, location);
    });
    return map;
  }, [locations]);

  const categoryById = useMemo(() => {
    const map = new Map<number, ScheduleCategoryApiResponse>();
    categories.forEach((category) => {
      map.set(category.id, category);
    });
    return map;
  }, [categories]);

  const activeTechnicians = useMemo(
    () =>
      technicians.filter(
        (technician) => technician.status.toLowerCase() === "active"
      ),
    [technicians]
  );

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active),
    [categories]
  );

  const hasActiveFilters =
    filterTechnicianId !== "" ||
    filterLocationId !== "" ||
    filterDay !== "" ||
    filterCategoryId !== "";

  function clearFilters() {
    setFilterTechnicianId("");
    setFilterLocationId("");
    setFilterDay("");
    setFilterCategoryId("");
  }

  const allAssignmentRows = useMemo(() => {
    if (!board) {
      return [];
    }

    const rows = board.assignments
      .map((assignment) => {
        const shift = shiftById.get(assignment.shift_id);

        if (!shift) {
          return null;
        }

        return {
          assignment,
          shift,
          technician: technicianById.get(assignment.technician_id),
          location: shift.location_id
            ? locationById.get(shift.location_id)
            : undefined,
          category: assignment.category_id
            ? categoryById.get(assignment.category_id)
            : undefined,
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
  }, [board, shiftById, technicianById, locationById, categoryById]);

  const assignmentRows = useMemo(() => {
    return allAssignmentRows.filter((row) => {
      if (
        filterTechnicianId !== "" &&
        row.assignment.technician_id !== filterTechnicianId
      ) {
        return false;
      }

      if (
        filterLocationId !== "" &&
        row.shift.location_id !== filterLocationId
      ) {
        return false;
      }

      if (filterDay !== "" && row.shift.day_of_week !== filterDay) {
        return false;
      }

      if (
        filterCategoryId !== "" &&
        row.assignment.category_id !== filterCategoryId
      ) {
        return false;
      }

      return true;
    });
  }, [
    allAssignmentRows,
    filterTechnicianId,
    filterLocationId,
    filterDay,
    filterCategoryId,
  ]);

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
        (board?.technicians_below_minimum ?? []).map(
          (entry) => entry.technician_id
        )
      ),
    [board]
  );

  const technicianHours = useMemo(() => {
    const hours = new Map<number, number>();

    activeTechnicians.forEach((technician) => {
      hours.set(technician.id, 0);
    });

    (board?.assignments ?? []).forEach((assignment) => {
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
  }, [activeTechnicians, board, shiftById]);

  const sortedShifts = useMemo(() => {
    return [...shifts].sort((a, b) => {
      const dayDiff = DAY_ORDER[a.day_of_week] - DAY_ORDER[b.day_of_week];

      if (dayDiff !== 0) {
        return dayDiff;
      }

      return a.start_time.localeCompare(b.start_time);
    });
  }, [shifts]);

  const selectedSchedule = useMemo(
    () =>
      schedules.find((schedule) => schedule.id === selectedScheduleId) ??
      null,
    [schedules, selectedScheduleId]
  );

  async function handleCreateSchedule(data: CreateSchedulePayload) {
    try {
      const created = await createSchedule(data);

      setScheduleDialogOpen(false);
      showSuccess("Schedule created.");

      const updatedSchedules = await getSchedules();
      setSchedules(updatedSchedules);
      setSelectedScheduleId(created.id);
    } catch (createError) {
      console.error("Failed to create schedule:", createError);
      throw createError;
    }
  }

  async function handleGenerate() {
    if (selectedScheduleId === null) {
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
      const result = await generateSchedule(selectedScheduleId);
      setBoard(result);
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
    if (selectedScheduleId === null) {
      return;
    }

    setPublishing(true);
    setError("");

    try {
      const result = await publishSchedule(selectedScheduleId);
      setBoard(result);
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
    if (!board?.public_token) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        buildPublicScheduleUrl(board.public_token)
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
    if (selectedScheduleId === null) {
      return;
    }

    try {
      await createShift({
        schedule_id: selectedScheduleId,
        ...data,
      });

      setShiftDialogOpen(false);
      showSuccess("Shift created.");

      await loadScheduleData(selectedScheduleId);
    } catch (createError) {
      console.error("Failed to create shift:", createError);
      throw createError;
    }
  }

  async function handleReassign(
    assignmentId: number,
    technicianId: number
  ) {
    const previousAssignment = board?.assignments.find(
      (candidate) => candidate.id === assignmentId
    );
    const previousTechnicianName = previousAssignment
      ? technicianById.get(previousAssignment.technician_id)?.name
      : undefined;
    const attemptedTechnicianName =
      technicianById.get(technicianId)?.name ?? "The selected technician";

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
      await editAssignment(assignmentId, { technician_id: technicianId });

      if (selectedScheduleId !== null) {
        await loadScheduleData(selectedScheduleId);
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

  async function handleCategoryChange(
    assignmentId: number,
    categoryId: number | ""
  ) {
    setReassigningId(assignmentId);

    try {
      await editAssignment(
        assignmentId,
        categoryId === ""
          ? { clear_category: true }
          : { category_id: categoryId }
      );

      if (selectedScheduleId !== null) {
        await loadScheduleData(selectedScheduleId);
      }

      showSuccess("Status updated.");
    } catch (updateError) {
      console.error("Failed to update category:", updateError);

      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update this assignment's status."
      );
    } finally {
      setReassigningId(null);
    }
  }

  async function handleManualAssign(shiftId: number) {
    if (
      selectedScheduleId === null ||
      assignPickerTechnicianId === ""
    ) {
      return;
    }

    setAssigningInProgress(true);
    setError("");

    try {
      await createAssignment(selectedScheduleId, {
        shift_id: shiftId,
        technician_id: assignPickerTechnicianId,
      });

      setAssigningShiftId(null);
      setAssignPickerTechnicianId("");

      await loadScheduleData(selectedScheduleId);
      showSuccess("Technician assigned.");
    } catch (assignError) {
      console.error("Failed to assign technician:", assignError);

      setError(
        assignError instanceof Error
          ? assignError.message
          : "Unable to assign this technician to the shift."
      );
    } finally {
      setAssigningInProgress(false);
    }
  }

  const hasShifts = shifts.length > 0;
  const hasAssignments = allAssignmentRows.length > 0;
  const uncoveredShifts = board?.uncovered_shifts ?? [];
  const belowMinimum = board?.technicians_below_minimum ?? [];
  const minimumWeeklyHours = board?.minimum_weekly_hours ?? 15;

  const assignedCountByShift = useMemo(() => {
    const counts = new Map<number, number>();
    (board?.assignments ?? []).forEach((assignment) => {
      counts.set(
        assignment.shift_id,
        (counts.get(assignment.shift_id) ?? 0) + 1
      );
    });
    return counts;
  }, [board]);

  return (
    <AppLayout>
      <div className="space-y-8">
        <section className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-medium text-neutral-500">
                Schedule Builder
              </p>

              {board && (
                <span
                  className={
                    board.published
                      ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                      : "rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600"
                  }
                >
                  {board.published ? "Published" : "Not Published"}
                </span>
              )}
            </div>

            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-neutral-950">
              {selectedSchedule ? selectedSchedule.name : "Schedule Builder"}
            </h1>

            <p className="mt-3 max-w-2xl text-base text-neutral-600">
              {selectedSchedule
                ? selectedSchedule.campaign_name
                  ? `Linked to "${selectedSchedule.campaign_name}". Generate and review technician assignments, or adjust them by hand.`
                  : "Built manually — no availability request is linked. Add shifts and assign technicians yourself."
                : "Create a schedule to get started, or select an existing one."}
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-3">
            <select
              value={selectedScheduleId ?? ""}
              onChange={(event) =>
                setSelectedScheduleId(
                  event.target.value ? Number(event.target.value) : null
                )
              }
              disabled={loadingSchedules || schedules.length === 0}
              className="h-12 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 outline-none transition focus:border-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-100"
            >
              {schedules.length === 0 && (
                <option value="">No schedules yet</option>
              )}

              {schedules.map((schedule) => (
                <option key={schedule.id} value={schedule.id}>
                  {schedule.name}
                  {schedule.campaign_name
                    ? ` (${schedule.campaign_name})`
                    : " (manual)"}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setScheduleDialogOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              <Plus size={17} />
              New Schedule
            </button>

            <button
              type="button"
              onClick={() =>
                selectedScheduleId !== null &&
                loadScheduleData(selectedScheduleId)
              }
              disabled={selectedScheduleId === null || loadingBoard}
              className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={loadingBoard ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={
                selectedScheduleId === null || generating || !hasShifts
              }
              title={
                !hasShifts
                  ? "This schedule has no shifts to generate yet."
                  : !selectedSchedule?.campaign_id
                    ? "No availability request is linked, so nothing will be auto-assigned. Assign technicians manually below instead."
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
                selectedScheduleId === null || publishing || !hasAssignments
              }
              title={
                !hasAssignments
                  ? "Assign at least one shift before publishing."
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

        {!loadingSchedules && schedules.length === 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center">
            <p className="font-medium text-neutral-900">
              No schedules yet
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              Click &ldquo;New Schedule&rdquo; to create one — with or
              without an availability request.
            </p>
          </div>
        )}

        {board?.published && board.public_token && (
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
                {buildPublicScheduleUrl(board.public_token)}
              </div>

              <a
                href={buildPublicScheduleUrl(board.public_token)}
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

        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <Filter size={16} />
              Filter this view
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50"
              >
                <X size={13} />
                Clear Filters
              </button>
            )}
          </div>

          <p className="mt-1 text-xs text-neutral-500">
            Filters only change what you see here — they never change the
            underlying schedule.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select
              value={filterTechnicianId}
              onChange={(event) =>
                setFilterTechnicianId(
                  event.target.value ? Number(event.target.value) : ""
                )
              }
              className="h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none focus:border-neutral-400"
            >
              <option value="">All technicians</option>
              {activeTechnicians.map((technician) => (
                <option key={technician.id} value={technician.id}>
                  {technician.name}
                </option>
              ))}
            </select>

            <select
              value={filterLocationId}
              onChange={(event) =>
                setFilterLocationId(
                  event.target.value ? Number(event.target.value) : ""
                )
              }
              className="h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none focus:border-neutral-400"
            >
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>

            <select
              value={filterDay}
              onChange={(event) =>
                setFilterDay(event.target.value as ShiftDay | "")
              }
              className="h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none focus:border-neutral-400"
            >
              <option value="">All days</option>
              {(Object.keys(DAY_LABELS) as ShiftDay[]).map((day) => (
                <option key={day} value={day}>
                  {DAY_LABELS[day]}
                </option>
              ))}
            </select>

            <select
              value={filterCategoryId}
              onChange={(event) =>
                setFilterCategoryId(
                  event.target.value ? Number(event.target.value) : ""
                )
              }
              className="h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none focus:border-neutral-400"
            >
              <option value="">All statuses</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold text-neutral-950">
                Coverage Shifts
              </h2>

              <p className="mt-1 text-sm text-neutral-500">
                Define the shifts technicians can be scheduled into for
                this schedule.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShiftDialogOpen(true)}
              disabled={selectedScheduleId === null}
              className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={17} />
              Add Shift
            </button>
          </div>

          {loadingBoard ? (
            <div className="p-12 text-center text-sm text-neutral-500">
              Loading shifts...
            </div>
          ) : !hasShifts ? (
            <div className="p-12 text-center">
              <p className="font-medium text-neutral-900">
                No shifts have been created for this schedule yet.
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                Add a shift to define when coverage is needed, then
                generate a schedule or assign technicians manually.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-neutral-200 bg-neutral-50">
                  <tr>
                    {[
                      "Day",
                      "Time",
                      "Location",
                      "Required Technicians",
                      "Hours",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {sortedShifts.map((shift) => {
                    const location = shift.location_id
                      ? locationById.get(shift.location_id)
                      : undefined;
                    const assignedCount =
                      assignedCountByShift.get(shift.id) ?? 0;
                    const needsMore =
                      assignedCount < shift.required_technicians;

                    return (
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
                          {location ? location.name : "Not set"}
                        </td>

                        <td className="px-6 py-4 text-sm text-neutral-700">
                          {assignedCount} of {shift.required_technicians}
                          {needsMore && (
                            <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                              needs more
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-sm text-neutral-500">
                          {shiftHours(shift.start_time, shift.end_time)}{" "}
                          hrs
                        </td>
                      </tr>
                    );
                  })}
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
                  Assign someone directly, or generate a schedule if this
                  schedule is linked to an availability request.
                </p>

                <ul className="mt-4 space-y-3">
                  {uncoveredShifts.map((uncovered) => (
                    <li
                      key={uncovered.shift_id}
                      className="rounded-xl bg-white px-4 py-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
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
                      </div>

                      {assigningShiftId === uncovered.shift_id ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <select
                            value={assignPickerTechnicianId}
                            onChange={(event) =>
                              setAssignPickerTechnicianId(
                                event.target.value
                                  ? Number(event.target.value)
                                  : ""
                              )
                            }
                            className="h-9 rounded-lg border border-neutral-200 bg-white px-2 text-sm text-neutral-900 outline-none focus:border-neutral-400"
                          >
                            <option value="">Choose a technician...</option>
                            {activeTechnicians.map((technician) => (
                              <option
                                key={technician.id}
                                value={technician.id}
                              >
                                {technician.name}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            disabled={
                              assignPickerTechnicianId === "" ||
                              assigningInProgress
                            }
                            onClick={() =>
                              handleManualAssign(uncovered.shift_id)
                            }
                            className="rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
                          >
                            {assigningInProgress
                              ? "Assigning..."
                              : "Assign"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setAssigningShiftId(null);
                              setAssignPickerTechnicianId("");
                            }}
                            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setAssigningShiftId(uncovered.shift_id)
                          }
                          className="mt-3 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
                        >
                          + Assign technician
                        </button>
                      )}
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
                  this schedule).
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

        {activeCategories.length > 0 && (
          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-neutral-900">
              Status legend
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Manage these in Settings. Color is always paired with a
              label, never used alone.
            </p>

            <div className="mt-3 flex flex-wrap gap-3">
              {activeCategories.map((category) => (
                <span
                  key={category.id}
                  className="flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700"
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                </span>
              ))}
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
              shift or change its status using the dropdowns.
            </p>
          </div>

          {loadingBoard ? (
            <div className="p-12 text-center text-sm text-neutral-500">
              Loading schedule...
            </div>
          ) : !hasShifts ? (
            <div className="p-12 text-center">
              <p className="font-medium text-neutral-900">
                No shifts have been created for this schedule yet.
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                Add shifts in the Coverage Shifts section above.
              </p>
            </div>
          ) : !hasAssignments ? (
            <div className="p-12 text-center">
              <p className="font-medium text-neutral-900">
                No one has been assigned yet
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                Click &ldquo;Generate Schedule&rdquo; if this is linked
                to an availability request, or assign technicians
                manually above.
              </p>
            </div>
          ) : dayGroups.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-medium text-neutral-900">
                No assignments match your filters
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                Try clearing filters to see the full draft schedule.
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
                        {rows.map(
                          ({ assignment, shift, technician, location }) => (
                            <tr
                              key={assignment.id}
                              className="border-b border-neutral-100 last:border-b-0"
                            >
                              <td className="w-48 px-6 py-4 text-sm text-neutral-700">
                                {formatTime(shift.start_time)} –{" "}
                                {formatTime(shift.end_time)}
                                <div className="mt-1 text-xs text-neutral-400">
                                  {location ? location.name : "No location"}
                                </div>
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

                              <td className="px-6 py-4">
                                <select
                                  value={assignment.category_id ?? ""}
                                  onChange={(event) =>
                                    handleCategoryChange(
                                      assignment.id,
                                      event.target.value
                                        ? Number(event.target.value)
                                        : ""
                                    )
                                  }
                                  disabled={reassigningId === assignment.id}
                                  className="h-10 w-full max-w-[10rem] rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-900 outline-none transition focus:border-neutral-950 disabled:cursor-not-allowed"
                                >
                                  <option value="">No status</option>
                                  {categories.map((category) => (
                                    <option
                                      key={category.id}
                                      value={category.id}
                                    >
                                      {category.name}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              <td className="px-6 py-4 text-right text-sm text-neutral-500">
                                {shiftHours(
                                  shift.start_time,
                                  shift.end_time
                                )}{" "}
                                hrs
                              </td>
                            </tr>
                          )
                        )}
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
        locations={locations}
        onClose={() => setShiftDialogOpen(false)}
        onSave={handleCreateShift}
      />

      <CreateScheduleDialog
        open={scheduleDialogOpen}
        availabilityRequests={availabilityRequests}
        onClose={() => setScheduleDialogOpen(false)}
        onSave={handleCreateSchedule}
      />
    </AppLayout>
  );
}
