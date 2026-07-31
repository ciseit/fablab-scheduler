"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Clock3,
  CalendarRange,
  Settings,
} from "lucide-react";
import clsx from "clsx";

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Technicians",
    href: "/technicians",
    icon: Users,
  },
  {
    name: "Campaigns",
    href: "/campaigns",
    icon: CalendarDays,
  },
  {
    name: "Availability",
    href: "/availability",
    icon: Clock3,
  },
  {
    name: "Schedule Builder",
    href: "/schedule-builder",
    icon: CalendarRange,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      <div className="border-b px-6 py-6">
        <h1 className="text-xl font-semibold tracking-tight">
          FABLAB
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Smart Scheduler
        </p>
      </div>

      <nav className="flex-1 space-y-2 p-4">
        {navigation.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all",
                pathname === item.href
                  ? "bg-black text-white"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Icon size={20} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-gray-600 hover:bg-gray-100"
        >
          <Settings size={20} />
          Settings
        </Link>
      </div>
    </aside>
  );
}