"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AppLayout from "@/components/layout/AppLayout";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import MetricsGrid from "@/components/dashboard/MetricsGrid";
import TodaysSchedule, {
  type TodaysScheduleItem,
} from "@/components/dashboard/TodaysSchedule";
import ActionRequired, {
  type ActionRequiredItem,
} from "@/components/dashboard/ActionRequired";
import QuickActions from "@/components/dashboard/QuickActions";
import RecentActivity from "@/components/dashboard/RecentActivity";
import ActiveCampaigns, {
  type ActiveCampaignItem,
} from "@/components/dashboard/ActiveCampaigns";

import { getTechnicians } from "@/lib/technicianApi";
import { getCurrentAdmin } from "@/lib/authApi";
import {
  getAvailabilityRequests,
  type AvailabilityRequestApiResponse,
} from "@/lib/availabilityRequestApi";
import { getShifts, type ShiftDay } from "@/lib/shiftApi";
import { getSchedule } from "@/lib/scheduleApi";

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

const WEEKDAYS: ShiftDay[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

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

function formatTime(value: string) {
  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText ?? "0");

  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = ((hours + 11) % 12) + 1;

  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

export default function DashboardPage() {
  const router = useRouter();

  const [technicians, setTechnicians] =
    useState<ApiTechnician[]>([]);

  const [requests, setRequests] = useState<
    DashboardRequest[]
  >([]);

  const [adminName, setAdminName] = useState<
    string | null
  >(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [todaysItems, setTodaysItems] = useState<
    TodaysScheduleItem[]
  >([]);
  const [todaysLoading, setTodaysLoading] =
    useState(false);

  const [copiedCampaignId, setCopiedCampaignId] =
    useState<number | null>(null);

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

      try {
        const admin = await getCurrentAdmin();
        setAdminName(admin.full_name);
      } catch {
        // Not fatal for the dashboard - just skip the personalized greeting.
        setAdminName(null);
      }
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

  const dateLabel = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    []
  );

  const todaysWeekday = useMemo(
    () => WEEKDAYS[new Date().getDay()],
    []
  );

  const activeCampaign = useMemo(
    () => requests.find(isRequestActive) ?? null,
    [requests]
  );

  useEffect(() => {
    if (!activeCampaign) {
      setTodaysItems([]);
      return;
    }

    let cancelled = false;
    setTodaysLoading(true);

    (async () => {
      try {
        const [shifts, schedule] = await Promise.all([
          getShifts(activeCampaign.id),
          getSchedule(activeCampaign.id),
        ]);

        if (cancelled) {
          return;
        }

        const technicianNamesById = new Map(
          technicians.map((technician) => [
            technician.id,
            technician.name,
          ])
        );

        const items: TodaysScheduleItem[] = shifts
          .filter(
            (shift) => shift.day_of_week === todaysWeekday
          )
          .map((shift) => ({
            shiftId: shift.id,
            startTime: formatTime(shift.start_time),
            endTime: formatTime(shift.end_time),
            requiredTechnicians: shift.required_technicians,
            technicianNames: schedule.assignments
              .filter(
                (assignment) =>
                  assignment.shift_id === shift.id
              )
              .map(
                (assignment) =>
                  technicianNamesById.get(
                    assignment.technician_id
                  ) ?? "Unknown technician"
              ),
          }))
          .sort((a, b) =>
            a.startTime.localeCompare(b.startTime)
          );

        setTodaysItems(items);
      } catch (todaysError) {
        console.error(
          "Failed to load today's schedule:",
          todaysError
        );

        if (!cancelled) {
          setTodaysItems([]);
        }
      } finally {
        if (!cancelled) {
          setTodaysLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCampaign, todaysWeekday, technicians]);

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

    const expectedSubmissions =
      activeCampaign?.total_technicians ??
      activeTechnicians;

    const activeRequestSubmitted =
      activeCampaign?.submitted_count ??
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
  }, [technicians, requests, activeCampaign]);

  const actionItems = useMemo(() => {
    const items: ActionRequiredItem[] = [];

    for (const request of requests) {
      if (!isRequestActive(request)) {
        continue;
      }

      const total = request.total_technicians ?? 0;
      const submitted = request.submitted_count ?? 0;

      if (total > 0 && submitted < total) {
        items.push({
          id: `submissions-${request.id}`,
          title: `${total - submitted} of ${total} technicians have not submitted availability`,
          description: `${request.name} closes ${new Date(
            request.closes_at
          ).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
          })}.`,
          action: "Review submissions",
          href: "/availability-requests",
        });
      }
    }

    const uncoveredToday = todaysItems.filter(
      (item) =>
        item.technicianNames.length <
        item.requiredTechnicians
    );

    if (uncoveredToday.length > 0) {
      items.push({
        id: "todays-coverage",
        title: `${uncoveredToday.length} shift${
          uncoveredToday.length === 1 ? "" : "s"
        } today need coverage`,
        description:
          "Some of today's shifts don't have enough technicians assigned.",
        action: "Resolve coverage",
        href: "/schedule-builder",
      });
    }

    return items;
  }, [requests, todaysItems]);

  const activeCampaignItems = useMemo<
    ActiveCampaignItem[]
  >(
    () =>
      requests.map((request) => {
        const status = normalizeStatus(request.status);

        const statusLabel: ActiveCampaignItem["statusLabel"] =
          status === "closed"
            ? "Closed"
            : isRequestActive(request)
              ? "Open"
              : "Draft";

        return {
          id: request.id,
          name: request.name,
          statusLabel,
          submittedCount: request.submitted_count ?? 0,
          totalTechnicians:
            request.total_technicians ?? 0,
          closesLabel: new Date(
            request.closes_at
          ).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
          }),
          publicToken: request.public_token,
          href: `/submit/${encodeURIComponent(
            request.public_token
          )}`,
        };
      }),
    [requests]
  );

  async function handleCopyLink(
    campaign: ActiveCampaignItem
  ) {
    setError("");

    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/submit/${encodeURIComponent(
          campaign.publicToken
        )}`
      );

      setCopiedCampaignId(campaign.id);

      window.setTimeout(() => {
        setCopiedCampaignId((currentId) =>
          currentId === campaign.id ? null : currentId
        );
      }, 2000);
    } catch (copyError) {
      console.error(
        "Failed to copy availability request link:",
        copyError
      );

      setError("Unable to copy the public link.");
    }
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <DashboardHeader
          adminName={adminName}
          dateLabel={dateLabel}
          activeTechnicians={metrics.activeTechnicians}
          activeRequests={metrics.activeRequests}
          loading={loading}
          onCreateRequest={() =>
            router.push("/availability-requests")
          }
        />

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
          <TodaysSchedule
            campaignName={activeCampaign?.name ?? null}
            dateLabel={dateLabel}
            items={todaysItems}
            loading={todaysLoading}
          />

          <div className="space-y-6">
            <QuickActions />
            <ActionRequired
              items={actionItems}
              loading={loading}
            />
            <RecentActivity />
          </div>
        </div>

        <ActiveCampaigns
          campaigns={activeCampaignItems}
          loading={loading}
          copiedCampaignId={copiedCampaignId}
          onCopyLink={handleCopyLink}
        />
      </div>
    </AppLayout>
  );
}
