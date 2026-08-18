"use client";

import { Plus } from "lucide-react";

type DashboardHeaderProps = {
  adminName: string | null;
  dateLabel: string;
  activeTechnicians: number;
  activeRequests: number;
  loading?: boolean;
  onCreateRequest: () => void;
};

export default function DashboardHeader({
  adminName,
  dateLabel,
  activeTechnicians,
  activeRequests,
  loading = false,
  onCreateRequest,
}: DashboardHeaderProps) {
  const greeting = adminName
    ? `Welcome back, ${adminName}`
    : "Welcome back";

  return (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">
          {dateLabel}
        </p>

        <h1 className="mt-2 text-5xl font-semibold tracking-tight">
          {greeting}
        </h1>

        <p className="mt-3 max-w-2xl text-sm font-medium text-gray-500">
          Your daily overview of technicians, requests, and
          today&rsquo;s schedule.
        </p>

        <p className="mt-2 max-w-2xl text-lg text-gray-600">
          {loading
            ? "Loading technician and request data..."
            : `You have ${activeTechnicians} active ${
                activeTechnicians === 1
                  ? "technician"
                  : "technicians"
              }. ${activeRequests} ${
                activeRequests === 1
                  ? "availability request is"
                  : "availability requests are"
              } currently open.`}
        </p>
      </div>

      <button
        type="button"
        onClick={onCreateRequest}
        className="flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-white transition hover:bg-neutral-800"
      >
        <Plus size={18} />
        Create Availability Request
      </button>
    </div>
  );
}
