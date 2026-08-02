"use client";

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  MoreHorizontal,
  Users,
} from "lucide-react";

export type AvailabilityRequest = {
  id: number;
  name: string;
  status: "Draft" | "Open" | "Closed";
  opensOn: string;
  closesOn: string;
  submittedCount: number;
  totalTechnicians: number;
  publicLink: string;
};

type AvailabilityRequestCardProps = {
  request: AvailabilityRequest;
  onCopyLink: (request: AvailabilityRequest) => void;
  onGenerateSchedule: (request: AvailabilityRequest) => void;
};

export default function AvailabilityRequestCard({
  request,
  onCopyLink,
  onGenerateSchedule,
}: AvailabilityRequestCardProps) {
  const progress =
    request.totalTechnicians > 0
      ? Math.round(
          (request.submittedCount / request.totalTechnicians) * 100
        )
      : 0;

  const statusClasses = {
    Draft: "bg-neutral-100 text-neutral-700",
    Open: "bg-emerald-50 text-emerald-700",
    Closed: "bg-amber-50 text-amber-700",
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
              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[request.status]}`}
            >
              {request.status}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-5 text-sm text-neutral-600">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} />
              Opens {request.opensOn}
            </div>

            <div className="flex items-center gap-2">
              <Clock3 size={16} />
              Closes {request.closesOn}
            </div>

            <div className="flex items-center gap-2">
              <Users size={16} />
              {request.submittedCount} of {request.totalTechnicians} submitted
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-label={`More actions for ${request.name}`}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50"
        >
          <MoreHorizontal size={18} />
        </button>
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
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-neutral-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <CheckCircle2 size={17} />
          {request.totalTechnicians - request.submittedCount} submissions missing
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onCopyLink(request)}
            className="flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            <Copy size={16} />
            Copy Link
          </button>

          <button
            type="button"
            onClick={() => onGenerateSchedule(request)}
            className="rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            Generate Schedule
          </button>
        </div>
      </div>
    </article>
  );
}