"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Printer } from "lucide-react";
import { useParams } from "next/navigation";

import {
  getPublicSchedule,
  type PublicAssignmentApiResponse,
  type PublicScheduleApiResponse,
} from "@/lib/scheduleApi";
import type { ShiftDay } from "@/lib/shiftApi";

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

  const dayGroups = useMemo(() => {
    if (!schedule) {
      return [];
    }

    const groups = new Map<ShiftDay, PublicAssignmentApiResponse[]>();

    schedule.assignments.forEach((assignment) => {
      const existing = groups.get(assignment.day_of_week) ?? [];
      existing.push(assignment);
      groups.set(assignment.day_of_week, existing);
    });

    return Array.from(groups.entries())
      .sort(([dayA], [dayB]) => DAY_ORDER[dayA] - DAY_ORDER[dayB])
      .map(([day, rows]) => ({
        day,
        rows: [...rows].sort((a, b) =>
          a.start_time.localeCompare(b.start_time)
        ),
      }));
  }, [schedule]);

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
      <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <section className="flex flex-col gap-4 border-b border-neutral-200 px-6 py-8 sm:flex-row sm:items-start sm:justify-between sm:px-10 print:border-neutral-300 print:px-0 print:py-4">
          <div>
            <p className="text-sm font-medium text-neutral-500">
              FABLAB Smart Scheduler
            </p>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-neutral-950">
              {schedule.campaign_name}
            </h1>

            <p className="mt-3 text-neutral-600">
              {schedule.semester}
            </p>

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

        <section className="px-6 py-8 sm:px-10 print:px-0 print:py-4">
          <h2 className="text-lg font-semibold text-neutral-950">
            Assignments
          </h2>

          {dayGroups.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">
              No shifts have been assigned yet.
            </p>
          ) : (
            <div className="mt-4 space-y-6">
              {dayGroups.map(({ day, rows }) => (
                <div
                  key={day}
                  className="overflow-hidden rounded-2xl border border-neutral-200 print:rounded-none print:border-neutral-300 print:break-inside-avoid"
                >
                  <div className="bg-neutral-50 px-5 py-3 text-sm font-semibold text-neutral-900 print:bg-white">
                    {DAY_LABELS[day]}
                  </div>

                  <table className="min-w-full">
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          key={`${row.shift_id}-${row.technician_name}`}
                          className="border-t border-neutral-200 print:border-neutral-300"
                        >
                          <td className="w-56 px-5 py-3 text-sm text-neutral-700">
                            {formatTime(row.start_time)} –{" "}
                            {formatTime(row.end_time)}
                          </td>

                          <td className="px-5 py-3 text-sm font-medium text-neutral-950">
                            {row.technician_name}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
