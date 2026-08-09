"use client";

import {
  Bell,
  ChevronDown,
  LogOut,
  Plus,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Header() {
  const router = useRouter();

  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      const response = await fetch("/api/backend/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        console.error(
          "Logout failed with status:",
          response.status
        );

        return;
      }

      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setLoggingOut(false);
    }
  }

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
          type="button"
          aria-label="Search"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 transition hover:bg-gray-50"
        >
          <Search size={18} />
        </button>

        <button
          type="button"
          aria-label="Notifications"
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

          <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <button
              type="button"
              className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50"
            >
              + Availability Request
            </button>

            <button
              type="button"
              className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50"
            >
              + Technician
            </button>
          </div>
        </details>

        <details className="relative ml-2">
          <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
            DJ
          </summary>

          <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogOut size={16} />

              {loggingOut ? "Signing out..." : "Log out"}
            </button>
          </div>
        </details>
      </div>
    </header>
  );
}