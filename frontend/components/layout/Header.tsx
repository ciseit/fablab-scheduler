"use client";

import { ChevronDown, LogOut, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import NotificationBell from "./NotificationBell";

export default function Header() {
  const router = useRouter();

  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const newMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (
        newMenuRef.current &&
        !newMenuRef.current.contains(target)
      ) {
        setNewMenuOpen(false);
      }

      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(target)
      ) {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function navigateTo(path: string) {
    setNewMenuOpen(false);
    router.push(path);
  }

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      const response = await fetch("/api/backend/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        console.error("Logout request failed");
      }
    } catch (error) {
      console.error("Unable to contact backend during logout:", error);
    } finally {
      setProfileMenuOpen(false);
      setLoggingOut(false);

      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <header className="flex h-20 items-center justify-between border-b border-gray-200 bg-white px-8">
      {/* Page title */}
      <div>
        <p className="text-sm text-gray-500">
          FABLAB Scheduler
        </p>

        <h2 className="text-xl font-semibold text-gray-900">
          Scheduling Workspace
        </h2>
      </div>

      {/* Header actions */}
      <div className="flex items-center gap-4">
        <NotificationBell />

        {/* New menu */}
        <div ref={newMenuRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setNewMenuOpen((current) => !current);
              setProfileMenuOpen(false);
            }}
            className="flex h-11 items-center gap-2 rounded-lg bg-black px-5 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            <Plus size={18} />
            <span>New</span>
            <ChevronDown
              size={16}
              className={`transition-transform ${
                newMenuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {newMenuOpen && (
            <div className="absolute right-0 top-14 z-50 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-2 shadow-lg">
              <button
                type="button"
                onClick={() => navigateTo("/availability-requests")}
                className="block w-full px-4 py-3 text-left text-sm text-gray-700 transition hover:bg-gray-50"
              >
                New Availability Request
              </button>

              <button
                type="button"
                onClick={() => navigateTo("/technicians")}
                className="block w-full px-4 py-3 text-left text-sm text-gray-700 transition hover:bg-gray-50"
              >
                Add Technician
              </button>

              <button
                type="button"
                onClick={() => navigateTo("/schedule-builder")}
                className="block w-full px-4 py-3 text-left text-sm text-gray-700 transition hover:bg-gray-50"
              >
                Schedule Builder
              </button>
            </div>
          )}
        </div>

        {/* Administrator profile */}
        <div ref={profileMenuRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setProfileMenuOpen((current) => !current);
              setNewMenuOpen(false);
            }}
            aria-label="Open administrator menu"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            DJ
          </button>

          {profileMenuOpen && (
            <div className="absolute right-0 top-14 z-50 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-medium text-gray-900">
                  Administrator
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  FABLAB Scheduler
                </p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogOut size={17} />

                {loggingOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}