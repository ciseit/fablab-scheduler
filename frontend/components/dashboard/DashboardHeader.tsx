import { Plus } from "lucide-react";

export default function DashboardHeader() {
  return (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">
          Tuesday, July 28
        </p>

        <h1 className="mt-2 text-5xl font-semibold tracking-tight">
          Good morning, Diana
        </h1>

        <p className="mt-4 max-w-2xl text-lg text-gray-600">
          You have 12 technicians available today.
          One scheduling campaign is currently active.
        </p>
      </div>

      <button className="flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-white transition hover:bg-neutral-800">
        <Plus size={18} />
        Create Campaign
      </button>
    </div>
  );
}