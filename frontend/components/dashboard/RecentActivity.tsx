import { Activity } from "lucide-react";

export default function RecentActivity() {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="text-lg font-semibold">Recent Activity</h2>

      <div className="mt-5 flex flex-col items-center gap-2 py-6 text-center">
        <div className="rounded-lg bg-neutral-100 p-2 text-neutral-500">
          <Activity size={18} />
        </div>

        <p className="text-sm text-neutral-500">
          Activity history isn&apos;t tracked yet. Submission and
          schedule changes will appear here in a future update.
        </p>
      </div>
    </section>
  );
}
