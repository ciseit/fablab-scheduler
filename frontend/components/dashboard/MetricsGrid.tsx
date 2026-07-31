import {
  CalendarCheck,
  Clock3,
  Users,
  AlertTriangle,
} from "lucide-react";

const metrics = [
  {
    label: "Active technicians",
    value: "18",
    helper: "16 currently available",
    icon: Users,
  },
  {
    label: "Open campaign",
    value: "1",
    helper: "Fall 2026 availability",
    icon: CalendarCheck,
  },
  {
    label: "Availability submitted",
    value: "14/18",
    helper: "4 submissions missing",
    icon: Clock3,
  },
  {
    label: "Scheduling issues",
    value: "3",
    helper: "Requires your review",
    icon: AlertTriangle,
  },
];

export default function MetricsGrid() {
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