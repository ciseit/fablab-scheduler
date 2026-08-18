"use client";

import { Plus, Search } from "lucide-react";

type AvailabilityRequestToolbarProps = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onCreateRequest: () => void;
  showArchived: boolean;
  onShowArchivedChange: (value: boolean) => void;
};

export default function AvailabilityRequestToolbar({
  searchTerm,
  onSearchChange,
  onCreateRequest,
  showArchived,
  onShowArchivedChange,
}: AvailabilityRequestToolbarProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-md">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
        />

        <input
          type="search"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search availability requests..."
          className="h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-10 pr-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white"
        />
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) =>
              onShowArchivedChange(event.target.checked)
            }
            className="h-4 w-4 rounded border-neutral-300"
          />
          Show archived
        </label>

        <button
          type="button"
          onClick={onCreateRequest}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          <Plus size={18} />
          New Availability Request
        </button>
      </div>
    </div>
  );
}