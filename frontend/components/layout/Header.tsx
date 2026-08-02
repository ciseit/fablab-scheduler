"use client";

import { Bell, Plus, Search } from "lucide-react";

export default function Header() {
  return (
    <header className="flex h-20 items-center justify-between border-b border-gray-200 bg-white px-8">
      <div>
        <p className="text-sm text-gray-500">FABLAB Scheduler</p>
        <h2 className="text-xl font-semibold text-gray-900">
          Scheduling workspace
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Search"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50"
        >
          <Search size={18} />
        </button>

        <button
          type="button"
          aria-label="Notifications"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50"
        >
          <Bell size={18} />
        </button>

        <button
          type="button"
          className="flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          <Plus size={18} />
          Quick create
        </button>

        <div className="ml-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
          DJ
        </div>
      </div>
    </header>
  );
}