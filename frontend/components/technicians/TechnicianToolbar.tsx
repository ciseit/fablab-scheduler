"use client";

import { Plus, Search } from "lucide-react";

type TechnicianToolbarProps = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onAddTechnician: () => void;
};

export default function TechnicianToolbar({
  searchTerm,
  onSearchChange,
  onAddTechnician,
}: TechnicianToolbarProps) {
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
          placeholder="Search technicians..."
          className="h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-10 pr-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white"
        />
      </div>

      <button
        type="button"
        onClick={onAddTechnician}
        className="flex h-11 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-medium text-white transition hover:bg-neutral-800"
      >
        <Plus size={18} />
        Add Technician
      </button>
    </div>
  );
}