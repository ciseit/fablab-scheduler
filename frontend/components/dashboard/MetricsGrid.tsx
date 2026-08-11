import {
  AlertTriangle,
  CalendarCheck,
  Clock3,
  Users,
} from "lucide-react";

type MetricsGridProps = {
  totalTechnicians: number;
  activeTechnicians: number;
  totalRequests: number;
  activeRequests: number;
  submittedCount: number;
  expectedSubmissions: number;
  totalAvailabilityBlocks: number;
  loading?: boolean;
};

export default function MetricsGrid({
  totalTechnicians,
  activeTechnicians,
  totalRequests,
  activeRequests,
  submittedCount,
  expectedSubmissions,
  totalAvailabilityBlocks,
  loading = false,
}: MetricsGridProps) {
  const missingSubmissions = Math.max(
    expectedSubmissions - submittedCount,
    0
  );

  const metrics = [
    {
      label: "Active technicians",
      value: loading
        ? "—"
        : String(activeTechnicians),
      helper: loading
        ? "Loading technician data"
        : `${totalTechnicians} ${
            totalTechnicians === 1
              ? "technician"
              : "technicians"
          } total`,
      icon: Users,
    },
    {
      label: "Availability requests",
      value: loading
        ? "—"
        : String(totalRequests),
      helper: loading
        ? "Loading request data"
        : `${activeRequests} currently open or active`,
      icon: CalendarCheck,
    },
    {
      label: "Availability submitted",
      value: loading
        ? "—"
        : expectedSubmissions > 0
          ? `${submittedCount}/${expectedSubmissions}`
          : String(submittedCount),
      helper: loading
        ? "Loading submission data"
        : expectedSubmissions > 0
          ? `${missingSubmissions} ${
              missingSubmissions === 1
                ? "submission"
                : "submissions"
            } remaining`
          : "Submission totals pending",
      icon: Clock3,
    },
    {
      label: "Availability blocks",
      value: loading
        ? "—"
        : String(totalAvailabilityBlocks),
      helper: loading
        ? "Loading availability data"
        : totalAvailabilityBlocks > 0
          ? "Saved across active requests"
          : "No saved blocks reported yet",
      icon: AlertTriangle,
    },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
    </section>
  );
}