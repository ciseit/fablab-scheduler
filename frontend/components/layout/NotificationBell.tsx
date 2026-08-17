"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationApiResponse,
} from "@/lib/notificationApi";

const POLL_INTERVAL_MS = 60_000;

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function NotificationBell() {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<
    NotificationApiResponse[]
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const menuRef = useRef<HTMLDivElement>(null);

  async function loadNotifications() {
    setLoading(true);
    setError("");

    try {
      const data = await getNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch (loadError) {
      console.error("Failed to load notifications:", loadError);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load notifications."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();

    const interval = window.setInterval(() => {
      void loadNotifications();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleToggle() {
    const next = !open;
    setOpen(next);

    if (next) {
      await loadNotifications();
    }
  }

  async function handleNotificationClick(
    notification: NotificationApiResponse
  ) {
    if (!notification.is_read) {
      try {
        await markNotificationRead(notification.id);

        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? { ...item, is_read: true }
              : item
          )
        );
        setUnreadCount((current) => Math.max(current - 1, 0));
      } catch (markError) {
        console.error("Failed to mark notification read:", markError);
      }
    }

    if (notification.link) {
      setOpen(false);
      router.push(notification.link);
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();

      setNotifications((current) =>
        current.map((item) => ({ ...item, is_read: true }))
      );
      setUnreadCount(0);
    } catch (markError) {
      console.error("Failed to mark all notifications read:", markError);
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 transition hover:bg-gray-50"
      >
        <Bell size={18} />

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">
              Notifications
            </p>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-gray-600 transition hover:text-gray-900"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">
                Loading...
              </p>
            ) : error ? (
              <p className="px-4 py-6 text-center text-sm text-red-600">
                {error}
              </p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">
                Nothing to see here yet.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() =>
                        handleNotificationClick(notification)
                      }
                      className={
                        notification.is_read
                          ? "block w-full px-4 py-3 text-left transition hover:bg-gray-50"
                          : "block w-full bg-blue-50/60 px-4 py-3 text-left transition hover:bg-blue-50"
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          {notification.title}
                        </p>

                        {!notification.is_read && (
                          <span
                            aria-hidden="true"
                            className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600"
                          />
                        )}
                      </div>

                      <p className="mt-1 text-xs text-gray-600">
                        {notification.message}
                      </p>

                      <p className="mt-1.5 text-xs text-gray-400">
                        {formatTimestamp(notification.created_at)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
