"use client";

import { Bell, ChevronDown, Plus, Search } from "lucide-react";

export default function Header() {
  return (
    <header className="flex h-20 items-center justify-between border-b border-gray-200 bg-white px-8">
      <div>
        <p className="text-sm text-gray-500">
          FABLAB Scheduler
        </p>

        <h2 className="text-xl font-semibold text-gray-900">
          Scheduling Workspace
        </h2>
      </div>

      <div className="flex items-center gap-3">

        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 transition hover:bg-gray-50"
        >
          <Search size={18} />
        </button>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 transition hover:bg-gray-50"
        >
          <Bell size={18} />
        </button>

        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white">
            <Plus size={18} />
            New
            <ChevronDown size={16} />
          </summary>

          <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">

            <button className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50">
              + Availability Request
            </button>

            <button className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50">
              + Technician
            </button>

          </div>
        </details>

        <div className="ml-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
          DJ
        </div>

      </div>
    </header>
  );
}