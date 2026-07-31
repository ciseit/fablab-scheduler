import { AlertTriangle, ArrowRight } from "lucide-react";

const issues = [
  {
    title: "Four technicians have not submitted availability",
    description: "Fall 2026 Technician Availability closes on August 7.",
    action: "View missing submissions",
  },
  {
    title: "Lunch coverage is still unassigned",
    description: "Tuesday from 1:00 PM to 2:00 PM needs coverage.",
    action: "Resolve coverage",
  },
];

export default function ActionRequired() {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60">
      <div className="flex items-start gap-3 border-b border-amber-200 px-6 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <AlertTriangle size={19} />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-neutral-950">
            Action required
          </h2>

          <p className="mt-1 text-sm text-neutral-600">
            Two items need your attention before publishing the schedule.
          </p>
        </div>
      </div>

      <div className="divide-y divide-amber-200">
        {issues.map((issue) => (
          <article
            key={issue.title}
            className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h3 className="font-medium text-neutral-950">
                {issue.title}
              </h3>

              <p className="mt-1 text-sm text-neutral-600">
                {issue.description}
              </p>
            </div>

            <button
              type="button"
              className="flex items-center gap-2 text-sm font-medium text-neutral-900 transition hover:text-neutral-600"
            >
              {issue.action}
              <ArrowRight size={16} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}