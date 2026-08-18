"use client";

import Link from "next/link";
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { formatUtcForDisplay } from "@/lib/datetimeUtils";

export type AvailabilityRequest = {
  id: number;
  name: string;
  semester?: string;
  status: string;
  is_accepting_submissions: boolean;
  has_opened: boolean;
  opens_at: string;
  closes_at: string;
  minimum_weekly_hours?: number;
  public_token: string;
  submitted_count?: number;
  total_technicians?: number;
};

type AvailabilityRequestCardProps = {
  request: AvailabilityRequest;
  onCopyLink: (request: AvailabilityRequest) => void;
  onOpenPublicForm: (request: AvailabilityRequest) => void;
  onEdit: (request: AvailabilityRequest) => void;
  onDelete: (request: AvailabilityRequest) => void;
  onArchive: (request: AvailabilityRequest) => void;
  onViewSubmissions: (request: AvailabilityRequest) => void;
  copied?: boolean;
  deleting?: boolean;
  archiving?: boolean;
};

function formatDate(dateValue: string) {
  return formatUtcForDisplay(dateValue, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AvailabilityRequestCard({
  request,
  onCopyLink,
  onOpenPublicForm,
  onEdit,
  onDelete,
  onArchive,
  onViewSubmissions,
  copied = false,
  deleting = false,
  archiving = false,
}: AvailabilityRequestCardProps) {
  const submittedCount = request.submitted_count ?? 0;
  const totalTechnicians = request.total_technicians ?? 0;

  const progress =
    totalTechnicians > 0
      ? Math.min(
          100,
          Math.round(
            (submittedCount / totalTechnicians) * 100
          )
        )
      : 0;

  const missingSubmissions = Math.max(
    totalTechnicians - submittedCount,
    0
  );

  const isArchived = request.status === "archived";

  // Computed live from opens_at/closes_at (see is_accepting_submissions
  // on the backend), not the request's raw `status` field -- that field
  // is never actually transitioned by anything today except the
  // explicit archive action, so it can't otherwise be trusted to
  // reflect whether this request is still open.
  const displayStatus = isArchived
    ? "Archived"
    : request.is_accepting_submissions
      ? "Open"
      : !request.has_opened
        ? "Not Open Yet"
        : "Closed";

  const statusClasses = {
    Open: "bg-emerald-50 text-emerald-700",
    "Not Open Yet": "bg-blue-50 text-blue-700",
    Closed: "bg-amber-50 text-amber-700",
    Archived: "bg-neutral-100 text-neutral-600",
  };

  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-neutral-950">
              {request.name}
            </h2>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[displayStatus]}`}
            >
              {displayStatus}
            </span>
          </div>

          {request.semester && (
            <p className="mt-2 text-sm text-neutral-500">
              {request.semester}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm text-neutral-600">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} />

              <span>
                Opens {formatDate(request.opens_at)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Clock3 size={16} />

              <span>
                Closes {formatDate(request.closes_at)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Users size={16} />

              {totalTechnicians > 0 ? (
                <button
                  type="button"
                  onClick={() => onViewSubmissions(request)}
                  className="underline decoration-dotted underline-offset-2 transition hover:text-neutral-950"
                >
                  {submittedCount} of {totalTechnicians} submitted —
                  see who
                </button>
              ) : (
                <span>Submission tracking pending</span>
              )}
            </div>
          </div>
        </div>

        <details className="relative">
          <summary
            aria-label={`More actions for ${request.name}`}
            className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50 [&::-webkit-details-marker]:hidden"
          >
            <MoreHorizontal size={18} />
          </summary>

          <div className="absolute right-0 top-12 z-20 w-52 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
            <button
              type="button"
              onClick={() => onOpenPublicForm(request)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-neutral-700 transition hover:bg-neutral-50"
            >
              <ExternalLink size={16} />
              Open public form
            </button>

            <button
              type="button"
              onClick={() => onCopyLink(request)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-neutral-700 transition hover:bg-neutral-50"
            >
              <Copy size={16} />
              Copy public link
            </button>

            <button
              type="button"
              onClick={() => onEdit(request)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-neutral-700 transition hover:bg-neutral-50"
            >
              <Pencil size={16} />
              Edit request
            </button>

            {!isArchived && (
              <button
                type="button"
                onClick={() => onArchive(request)}
                disabled={archiving}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Archive size={16} />
                {archiving ? "Archiving..." : "Archive request"}
              </button>
            )}

            <div className="my-1 border-t border-neutral-100" />

            <button
              type="button"
              onClick={() => onDelete(request)}
              disabled={deleting}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={16} />
              {deleting ? "Deleting..." : "Delete request"}
            </button>
          </div>
        </details>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-neutral-700">
            Submission progress
          </span>

          <span className="font-semibold text-neutral-950">
            {progress}%
          </span>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-black transition-all"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-neutral-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <CheckCircle2 size={17} />

          {totalTechnicians > 0 ? (
            <span>
              {missingSubmissions}{" "}
              {missingSubmissions === 1
                ? "submission"
                : "submissions"}{" "}
              missing
            </span>
          ) : (
            <span>Waiting for submission tracking data</span>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onCopyLink(request)}
            className="flex min-w-32 items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            {copied ? (
              <CheckCircle2
                size={16}
                className="text-emerald-600"
              />
            ) : (
              <Copy size={16} />
            )}

            {copied ? "Link copied" : "Copy Link"}
          </button>

          <Link
            href={`/schedule-builder?campaignId=${request.id}`}
            className="flex items-center justify-center rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            Generate Schedule
          </Link>
        </div>
      </div>
    </article>
  );
}