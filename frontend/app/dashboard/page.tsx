"use client";

import { useEffect, useMemo, useState } from "react";

import AppLayout from "@/components/layout/AppLayout";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import MetricsGrid from "@/components/dashboard/MetricsGrid";
import TodaysSchedule from "@/components/dashboard/TodaysSchedule";
import ActionRequired from "@/components/dashboard/ActionRequired";
import QuickActions from "@/components/dashboard/QuickActions";
import RecentActivity from "@/components/dashboard/RecentActivity";
import ActiveCampaigns from "@/components/dashboard/ActiveCampaigns";

import { getTechnicians } from "@/lib/technicianApi";
import {
  getAvailabilityRequests,
  type AvailabilityRequestApiResponse,
} from "@/lib/availabilityRequestApi";

type ApiTechnician = {
  id: number;
  name: string;
  email: string;
  designation: string;
  status: string;
  weekly_target_hours: number;
  notes?: string | null;
};

type DashboardRequest =
  AvailabilityRequestApiResponse & {
    total_availability_blocks?: number;
  };

function normalizeStatus(status: string) {
  return status.trim().toLowerCase();
}

function isRequestActive(
  request: DashboardRequest
) {
  const status = normalizeStatus(request.status);

  if (status === "open") {
    return true;
  }

  if (status === "closed") {
    return false;
  }

  const now = Date.now();
  const opensAt = new Date(
    request.opens_at
  ).getTime();
  const closesAt = new Date(
    request.closes_at
  ).getTime();

  if (
    Number.isNaN(opensAt) ||
    Number.isNaN(closesAt)
  ) {
    return status === "draft";
  }

  return now >= opensAt && now <= closesAt;
}

export default function DashboardPage() {
  const [technicians, setTechnicians] =
    useState<ApiTechnician[]>([]);

  const [requests, setRequests] = useState<
    DashboardRequest[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboardData() {
    setLoading(true);
    setError("");

    try {
      const [
        technicianResponse,
        requestResponse,
      ] = await Promise.all([
        getTechnicians(),
        getAvailabilityRequests(),
      ]);

      setTechnicians(
        technicianResponse as ApiTechnician[]
      );

      setRequests(
        requestResponse as DashboardRequest[]
      );
    } catch (loadError) {
      console.error(
        "Failed to load dashboard data:",
        loadError
      );

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboardData();
  }, []);

  const metrics = useMemo(() => {
    const totalTechnicians =
      technicians.length;

    const activeTechnicians =
      technicians.filter(
        (technician) =>
          normalizeStatus(
            technician.status
          ) === "active"
      ).length;

    const totalRequests = requests.length;

    const activeRequests =
      requests.filter(isRequestActive).length;

    const submittedCount = requests.reduce(
      (total, request) =>
        total +
        (request.submitted_count ?? 0),
      0
    );

    const totalAvailabilityBlocks =
      requests.reduce(
        (total, request) =>
          total +
          (request.total_availability_blocks ??
            0),
        0
      );

    /*
     * Om's backend will return total_technicians
     * per request. Until then, use the active
     * technician count as the denominator for
     * the current active request.
     */
    const activeRequest =
      requests.find(isRequestActive);

    const expectedSubmissions =
      activeRequest?.total_technicians ??
      activeTechnicians;

    const activeRequestSubmitted =
      activeRequest?.submitted_count ??
      submittedCount;

    return {
      totalTechnicians,
      activeTechnicians,
      totalRequests,
      activeRequests,
      submittedCount:
        activeRequestSubmitted,
      expectedSubmissions,
      totalAvailabilityBlocks,
    };
  }, [technicians, requests]);

  return (
    <AppLayout>
      <div className="space-y-8">
        <DashboardHeader />

        {error && (
          <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Dashboard data could not be
              loaded. {error}
            </p>

            <button
              type="button"
              onClick={() =>
                void loadDashboardData()
              }
              className="rounded-lg border border-red-200 bg-white px-3 py-2 font-medium text-red-700 transition hover:bg-red-100"
            >
              Try again
            </button>
          </div>
        )}

        <MetricsGrid
          totalTechnicians={
            metrics.totalTechnicians
          }
          activeTechnicians={
            metrics.activeTechnicians
          }
          totalRequests={
            metrics.totalRequests
          }
          activeRequests={
            metrics.activeRequests
          }
          submittedCount={
            metrics.submittedCount
          }
          expectedSubmissions={
            metrics.expectedSubmissions
          }
          totalAvailabilityBlocks={
            metrics.totalAvailabilityBlocks
          }
          loading={loading}
        />

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <TodaysSchedule />

          <div className="space-y-6">
            <QuickActions />
            <ActionRequired />
            <RecentActivity />
          </div>
        </div>

        <ActiveCampaigns />
      </div>
    </AppLayout>
  );
}