"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  RefreshCw,
  Send,
} from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";

type ScheduleStatus = "Draft" | "Published";

type ScheduleRow = {
  id: number;
  day: string;
  date: string;
  time: string;
  technician: string;
  assignment: string;
  status: "Assigned" | "Unassigned";
};

const initialSchedule: ScheduleRow[] = [
  {
    id: 1,
    day: "Monday",
    date: "August 10",
    time: "9:00 AM – 1:00 PM",
    technician: "Maya Patel",
    assignment: "Laser Lab",
    status: "Assigned",
  },
  {
    id: 2,
    day: "Monday",
    date: "August 10",
    time: "11:00 AM – 3:00 PM",
    technician: "Jordan Lee",
    assignment: "Carson High School",
    status: "Assigned",
  },
  {
    id: 3,
    day: "Monday",
    date: "August 10",
    time: "1:00 PM – 2:00 PM",
    technician: "Unassigned",
    assignment: "Lunch Coverage",
    status: "Unassigned",
  },
  {
    id: 4,
    day: "Wednesday",
    date: "August 12",
    time: "10:00 AM – 2:00 PM",
    technician: "Alex Kim",
    assignment: "3D Printing Lab",
    status: "Assigned",
  },
  {
    id: 5,
    day: "Friday",
    date: "August 14",
    time: "9:00 AM – 5:00 PM",
    technician: "Sarah Johnson",
    assignment: "Orientation Team",
    status: "Assigned",
  },
];

export default function ScheduleBuilderPage() {
  const [status, setStatus] = useState<ScheduleStatus>("Draft");
  const [linkCopied, setLinkCopied] = useState(false);

  const assignedCount = initialSchedule.filter(
    (row) => row.status === "Assigned"
  ).length;

  const unassignedCount = initialSchedule.filter(
    (row) => row.status === "Unassigned"
  ).length;

  async function copyShareableLink() {
    const link =
      "https://fablab.app/schedule/week-of-august-10-2026";

    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);

      window.setTimeout(() => {
        setLinkCopied(false);
      }, 2000);
    } catch {
      window.alert("Unable to copy the shareable link.");
    }
  }

  function publishSchedule() {
    setStatus("Published");
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <section className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-medium text-neutral-500">
                Schedule Builder
              </p>

              <span
                className={
                  status === "Published"
                    ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                    : "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
                }
              >
                {status}
              </span>
            </div>

            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-neutral-950">
              Week of August 10 – August 16
            </h1>

            <p className="mt-3 max-w-2xl text-base text-neutral-600">
              {status === "Published"
                ? "This schedule is final, read-only, and ready to share."
                : "Review technician assignments, resolve missing coverage, and publish when ready."}
            </p>
          </div>

          {status === "Draft" ? (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                <RefreshCw size={17} />
                Generate Again
              </button>

              <button
                type="button"
                className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                <Eye size={17} />
                Preview PDF
              </button>

              <button
                type="button"
                onClick={publishSchedule}
                className="flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
              >
                <Send size={17} />
                Publish Schedule
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                <Eye size={17} />
                View Published Schedule
              </button>

              <button
                type="button"
                className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                <Download size={17} />
                Download PDF
              </button>

              <button
                type="button"
                onClick={copyShareableLink}
                className="flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
              >
                <Copy size={17} />
                {linkCopied ? "Link Copied" : "Copy Shareable Link"}
              </button>
            </div>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-sm text-neutral-500">Technicians</p>
            <p className="mt-3 text-3xl font-semibold text-neutral-950">18</p>
          </article>

          <article className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-sm text-neutral-500">Assigned shifts</p>
            <p className="mt-3 text-3xl font-semibold text-neutral-950">
              {assignedCount}
            </p>
          </article>

          <article className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-sm text-neutral-500">Unassigned shifts</p>
            <p className="mt-3 text-3xl font-semibold text-neutral-950">
              {unassignedCount}
            </p>
          </article>

          <article className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-sm text-neutral-500">Conflicts</p>
            <p className="mt-3 text-3xl font-semibold text-neutral-950">0</p>
          </article>
        </section>

        {status === "Published" && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 size={22} />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-neutral-950">
                  Schedule published successfully
                </h2>

                <p className="mt-1 text-sm text-neutral-600">
                  The final schedule can now be viewed online, downloaded as a
                  PDF, or shared using the public link.
                </p>
              </div>
            </div>
          </section>
        )}

        {status === "Draft" && unassignedCount > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <AlertTriangle size={22} />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-neutral-950">
                  Action required before publishing
                </h2>

                <p className="mt-1 text-sm text-neutral-600">
                  {unassignedCount} shift still needs technician coverage.
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold text-neutral-950">
                Schedule Preview
              </h2>

              <p className="mt-1 text-sm text-neutral-500">
                {status === "Published"
                  ? "Read-only published schedule"
                  : "Draft schedule ready for review"}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr>
                  {[
                    "Day",
                    "Time",
                    "Technician",
                    "Current Assignment",
                    "Status",
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
                {initialSchedule.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-neutral-200 last:border-b-0"
                  >
                    <td className="px-6 py-5">
                      <p className="font-medium text-neutral-950">
                        {row.day}
                      </p>
                      <p className="mt-1 text-sm text-neutral-500">
                        {row.date}
                      </p>
                    </td>

                    <td className="px-6 py-5 text-sm text-neutral-700">
                      {row.time}
                    </td>

                    <td className="px-6 py-5">
                      <p
                        className={
                          row.status === "Unassigned"
                            ? "font-medium text-amber-700"
                            : "font-medium text-neutral-950"
                        }
                      >
                        {row.technician}
                      </p>
                    </td>

                    <td className="px-6 py-5">
                      <span className="rounded-full bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700">
                        {row.assignment}
                      </span>
                    </td>

                    <td className="px-6 py-5">
                      <span
                        className={
                          row.status === "Assigned"
                            ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                            : "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
                        }
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {status === "Published" && (
          <section className="rounded-2xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-neutral-950">
              Shareable Schedule Link
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Technicians can open this link, select their name, and view only
              their assigned schedule.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <div className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                https://fablab.app/schedule/week-of-august-10-2026
              </div>

              <button
                type="button"
                onClick={copyShareableLink}
                className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                <Copy size={17} />
                {linkCopied ? "Copied" : "Copy"}
              </button>
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}