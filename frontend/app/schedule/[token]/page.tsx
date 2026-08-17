"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Filter, Loader2, Printer, X } from "lucide-react";
import { useParams } from "next/navigation";

import {
  getPublicSchedule,
  type PublicAssignmentApiResponse,
  type PublicScheduleApiResponse,
} from "@/lib/scheduleApi";
import type { ShiftDay } from "@/lib/shiftApi";

const DAYS: ShiftDay[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const DAY_LABELS: Record<ShiftDay, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
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

function formatPublishedDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function PublicSchedulePage() {
  const params = useParams<{ token: string }>();

  const token =
    typeof params.token === "string" ? params.token : "";

  const [schedule, setSchedule] =
    useState<PublicScheduleApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [viewMode, setViewMode] = useState<"everyone" | "mine">(
    "everyone"
  );
  const [selectedTechnician, setSelectedTechnician] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterDay, setFilterDay] = useState<ShiftDay | "">("");
  const [filterCategory, setFilterCategory] = useState("");

  useEffect(() => {
    async function loadSchedule() {
      if (!token) {
        setError("This schedule link is missing its token.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const data = await getPublicSchedule(token);
        setSchedule(data);
      } catch (loadError) {
        console.error(
          "Failed to load published schedule:",
          loadError
        );

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load this schedule."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadSchedule();
  }, [token]);

  const technicianNames = useMemo(() => {
    if (!schedule) {
      return [];
    }

    const names = new Set(
      schedule.assignments.map((row) => row.technician_name)
    );

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [schedule]);

  const locationNames = useMemo(() => {
    if (!schedule) {
      return [];
    }

    const names = new Set(
      schedule.assignments
        .map((row) => row.location_name)
        .filter((name): name is string => Boolean(name))
    );

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [schedule]);

  const categoryOptions = useMemo(() => {
    if (!schedule) {
      return [];
    }

    const byName = new Map<string, string | null>();

    schedule.assignments.forEach((row) => {
      if (row.category_name) {
        byName.set(row.category_name, row.category_color);
      }
    });

    return Array.from(byName.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, color]) => ({ name, color }));
  }, [schedule]);

  const hasActiveFilters =
    (viewMode === "mine" && selectedTechnician !== "") ||
    filterLocation !== "" ||
    filterDay !== "" ||
    filterCategory !== "";

  function clearFilters() {
    setFilterLocation("");
    setFilterDay("");
    setFilterCategory("");

    if (viewMode === "mine") {
      setViewMode("everyone");
      setSelectedTechnician("");
    }
  }

  const filteredAssignments = useMemo(() => {
    if (!schedule) {
      return [];
    }

    return schedule.assignments.filter((row) => {
      if (
        viewMode === "mine" &&
        selectedTechnician &&
        row.technician_name !== selectedTechnician
      ) {
        return false;
      }

      if (filterLocation && row.location_name !== filterLocation) {
        return false;
      }

      if (filterDay && row.day_of_week !== filterDay) {
        return false;
      }

      if (filterCategory && row.category_name !== filterCategory) {
        return false;
      }

      return true;
    });
  }, [schedule, viewMode, selectedTechnician, filterLocation, filterDay, filterCategory]);

  const weekGroups = useMemo(() => {
    const groups = new Map<ShiftDay, PublicAssignmentApiResponse[]>();

    filteredAssignments.forEach((assignment) => {
      const existing = groups.get(assignment.day_of_week) ?? [];
      existing.push(assignment);
      groups.set(assignment.day_of_week, existing);
    });

    return DAYS.map((day) => ({
      day,
      rows: (groups.get(day) ?? []).sort((a, b) =>
        a.start_time.localeCompare(b.start_time)
      ),
    }));
  }, [filteredAssignments]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white px-8 py-10 text-center shadow-sm">
          <Loader2
            size={28}
            className="mx-auto animate-spin text-neutral-600"
          />

          <p className="mt-4 font-medium text-neutral-900">
            Loading schedule...
          </p>
        </div>
      </main>
    );
  }

  if (error || !schedule) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
        <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertCircle size={24} />
          </div>

          <h1 className="mt-5 text-2xl font-semibold text-neutral-950">
            Schedule unavailable
          </h1>

          <p className="mt-3 text-sm text-red-700">
            {error || "Unable to load this schedule."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10 sm:px-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <section className="flex flex-col gap-4 border-b border-neutral-200 px-6 py-8 sm:flex-row sm:items-start sm:justify-between sm:px-10 print:border-neutral-300 print:px-0 print:py-4">
          <div>
            <p className="text-sm font-medium text-neutral-500">
              FABLAB Smart Scheduler
            </p>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-neutral-950">
              {schedule.schedule_name}
            </h1>

            {schedule.semester && (
              <p className="mt-3 text-neutral-600">{schedule.semester}</p>
            )}

            <p className="mt-1 text-sm text-neutral-500">
              Published {formatPublishedDate(schedule.published_at)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 print:hidden"
          >
            <Printer size={17} />
            Print / Save as PDF
          </button>
        </section>

        <section className="border-b border-neutral-200 px-6 py-6 sm:px-10 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setViewMode("everyone");
                setSelectedTechnician("");
              }}
              className={
                viewMode === "everyone"
                  ? "rounded-full bg-black px-4 py-2 text-sm font-medium text-white"
                  : "rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              }
            >
              Everyone
            </button>

            <button
              type="button"
              onClick={() => setViewMode("mine")}
              className={
                viewMode === "mine"
                  ? "rounded-full bg-black px-4 py-2 text-sm font-medium text-white"
                  : "rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              }
            >
              My Schedule
            </button>

            {viewMode === "mine" && (
              <select
                value={selectedTechnician}
                onChange={(event) =>
                  setSelectedTechnician(event.target.value)
                }
                className="h-10 rounded-full border border-neutral-200 bg-white px-4 text-sm text-neutral-700 outline-none focus:border-neutral-400"
              >
                <option value="">Select your name...</option>
                {technicianNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <Filter size={14} />
              Filters
            </div>

            <select
              value={filterLocation}
              onChange={(event) => setFilterLocation(event.target.value)}
              className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none focus:border-neutral-400"
            >
              <option value="">All locations</option>
              {locationNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={filterDay}
              onChange={(event) =>
                setFilterDay(event.target.value as ShiftDay | "")
              }
              className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none focus:border-neutral-400"
            >
              <option value="">All days</option>
              {DAYS.map((day) => (
                <option key={day} value={day}>
                  {DAY_LABELS[day]}
                </option>
              ))}
            </select>

            <select
              value={filterCategory}
              onChange={(event) => setFilterCategory(event.target.value)}
              className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none focus:border-neutral-400"
            >
              <option value="">All statuses</option>
              {categoryOptions.map((category) => (
                <option key={category.name} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>

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

          {categoryOptions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3 border-t border-neutral-100 pt-4">
              {categoryOptions.map((category) => (
                <span
                  key={category.name}
                  className="flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700"
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: category.color ?? "#a3a3a3",
                    }}
                  />
                  {category.name}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="px-6 py-8 sm:px-10 print:px-0 print:py-4">
          <h2 className="text-lg font-semibold text-neutral-950">
            Weekly Schedule
          </h2>

          {filteredAssignments.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">
              {viewMode === "mine" && !selectedTechnician
                ? "Select your name above to see your schedule."
                : "No shifts match the current view."}
            </p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
              {weekGroups.map(({ day, rows }) => (
                <div
                  key={day}
                  className="overflow-hidden rounded-2xl border border-neutral-200 print:break-inside-avoid print:border-neutral-300"
                >
                  <div className="bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-900 print:bg-white">
                    {DAY_LABELS[day]}
                  </div>

                  {rows.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-neutral-400">
                      Not assigned
                    </p>
                  ) : (
                    <ul className="divide-y divide-neutral-100">
                      {rows.map((row) => (
                        <li
                          key={`${row.shift_id}-${row.technician_name}`}
                          className="px-4 py-3"
                        >
                          <p className="text-sm font-medium text-neutral-950">
                            {row.technician_name}
                          </p>
                          <p className="mt-0.5 text-xs text-neutral-500">
                            {formatTime(row.start_time)} –{" "}
                            {formatTime(row.end_time)}
                          </p>

                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            {row.location_name && (
                              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                                {row.location_name}
                              </span>
                            )}

                            {row.category_name && (
                              <span className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-700">
                                <span
                                  aria-hidden="true"
                                  className="h-2 w-2 rounded-full"
                                  style={{
                                    backgroundColor:
                                      row.category_color ?? "#a3a3a3",
                                  }}
                                />
                                {row.category_name}
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="border-t border-neutral-200 px-6 py-8 sm:px-10 print:break-inside-avoid print:border-neutral-300 print:px-0 print:py-4">
          <h2 className="text-lg font-semibold text-neutral-950">
            Weekly Hours
          </h2>

          {schedule.technician_hours.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">
              No hours have been assigned yet.
            </p>
          ) : (
            <table className="mt-4 min-w-full overflow-hidden rounded-xl border border-neutral-200 print:rounded-none print:border-neutral-300">
              <thead className="bg-neutral-50 print:bg-white">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Technician
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Hours
                  </th>
                </tr>
              </thead>

              <tbody>
                {schedule.technician_hours.map((entry) => (
                  <tr
                    key={entry.technician_name}
                    className="border-t border-neutral-200 print:border-neutral-300"
                  >
                    <td className="px-5 py-3 text-sm font-medium text-neutral-950">
                      {entry.technician_name}
                    </td>

                    <td className="px-5 py-3 text-sm text-neutral-700">
                      {entry.assigned_hours} hrs
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
