"use client";

import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";

export type ActionRequiredItem = {
  id: string;
  title: string;
  description: string;
  action: string;
  href: string;
};

type ActionRequiredProps = {
  items: ActionRequiredItem[];
  loading?: boolean;
};

export default function ActionRequired({
  items,
  loading = false,
}: ActionRequiredProps) {
  if (loading) {
    return (
      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-950">
          Action required
        </h2>
        <p className="mt-2 text-sm text-neutral-500">Loading...</p>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <CheckCircle2 size={19} />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-neutral-950">
              All caught up
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              No outstanding items need your attention right now.
            </p>
          </div>
        </div>
      </section>
    );
  }

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
            {items.length} {items.length === 1 ? "item needs" : "items need"}{" "}
            your attention.
          </p>
        </div>
      </div>

      <div className="divide-y divide-amber-200">
        {items.map((issue) => (
          <article
            key={issue.id}
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

            <a
              href={issue.href}
              className="flex items-center gap-2 text-sm font-medium text-neutral-900 transition hover:text-neutral-600"
            >
              {issue.action}
              <ArrowRight size={16} />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
