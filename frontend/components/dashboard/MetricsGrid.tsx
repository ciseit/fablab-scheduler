"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  Clock3,
  Users,
} from "lucide-react";

import { getTechnicians } from "@/lib/technicianApi";
import { getAvailabilityRequests } from "@/lib/availabilityRequestApi";

type ApiTechnician = {
  id: number;
  name: string;
  email: string;
  designation: string;
  status: string;
  weekly_target_hours: number;
  notes?: string | null;
};

type ApiAvailabilityRequest = {
  id: number;
  name: string;
  semester: string;
  opens_at: string;
  closes_at: string;
  minimum_weekly_hours: number;
  public_token: string;
  status: string;
  submitted_count?: number;
  total_technicians?: number;
};

export default function MetricsGrid() {
  const [technicians, setTechnicians] = useState<ApiTechnician[]>([]);
  const [requests, setRequests] = useState<ApiAvailabilityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadMetrics() {
      setLoading(true);
      setError("");

      try {
        const [technicianData, requestData] = await Promise.all([
          getTechnicians(),
          getAvailabilityRequests(),
        ]);

        setTechnicians(technicianData as ApiTechnician[]);
        setRequests(requestData as ApiAvailabilityRequest[]);
      } catch (loadError) {
        console.error("Failed to load dashboard metrics:", loadError);

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load dashboard metrics."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadMetrics();
  }, []);

  const activeTechnicians = useMemo(
    () =>
      technicians.filter(
        (technician) =>
          technician.status.trim().toLowerCase() === "active"
      ).length,
    [technicians]
  );

  const openRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          request.status.trim().toLowerCase() === "open"
      ).length,
    [requests]
  );

  const totalSubmitted = useMemo(
    () =>
      requests.reduce(
        (total, request) => total + (request.submitted_count ?? 0),
        0
      ),
    [requests]
  );

  const totalExpectedSubmissions = useMemo(
    () =>
      requests.reduce(
        (total, request) =>
          total + (request.total_technicians ?? technicians.length),
        0
      ),
    [requests, technicians.length]
  );

  const missingSubmissions = Math.max(
    totalExpectedSubmissions - totalSubmitted,
    0
  );

  const metrics = [
    {
      label: "Active technicians",
      value: loading ? "—" : String(activeTechnicians),
      helper: loading
        ? "Loading technician data"
        : `${technicians.length} total technician${
            technicians.length === 1 ? "" : "s"
          }`,
      icon: Users,
    },
    {
      label: "Open requests",
      value: loading ? "—" : String(openRequests),
      helper: loading
        ? "Loading request data"
        : `${requests.length} total availability request${
            requests.length === 1 ? "" : "s"
          }`,
      icon: CalendarCheck,
    },
    {
      label: "Availability submitted",
      value: loading
        ? "—"
        : totalExpectedSubmissions > 0
          ? `${totalSubmitted}/${totalExpectedSubmissions}`
          : "Pending",
      helper: loading
        ? "Loading submission data"
        : totalExpectedSubmissions > 0
          ? `${missingSubmissions} submission${
              missingSubmissions === 1 ? "" : "s"
            } missing`
          : "Waiting for submission tracking API",
      icon: Clock3,
    },
    {
      label: "Scheduling issues",
      value: loading ? "—" : "0",
      helper: loading
        ? "Loading issue data"
        : "No detected conflicts yet",
      icon: AlertTriangle,
    },
  ];

  return (
    <section className="space-y-4">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <article
              key={metric.label}
              className="rounded-2xl border border-neutral-200 bg-white p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-neutral-500">
                  {metric.label}
                </p>

                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                  <Icon size={18} />
                </div>
              </div>

              <p className="mt-6 text-3xl font-semibold tracking-tight text-neutral-950">
                {metric.value}
              </p>

              <p className="mt-2 text-sm text-neutral-500">
                {metric.helper}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}