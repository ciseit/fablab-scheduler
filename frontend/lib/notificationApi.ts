const API_URL = "/api/backend";

type BackendErrorBody = { detail?: string };

async function request<T>(
  path: string,
  options: RequestInit = {},
  fallbackMessage = "Request failed. Please try again."
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorBody: BackendErrorBody | null = null;

    try {
      errorBody = (await response.json()) as BackendErrorBody;
    } catch {
      errorBody = null;
    }

    throw new Error(errorBody?.detail || fallbackMessage);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

export type NotificationApiResponse = {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export type NotificationListApiResponse = {
  unread_count: number;
  notifications: NotificationApiResponse[];
};

export function getNotifications() {
  return request<NotificationListApiResponse>(
    "/notifications",
    {},
    "Unable to load notifications."
  );
}

export function markNotificationRead(notificationId: number) {
  return request<NotificationApiResponse>(
    `/notifications/${notificationId}/read`,
    { method: "POST" },
    "Unable to update this notification."
  );
}

export function markAllNotificationsRead() {
  return request<null>(
    "/notifications/read-all",
    { method: "POST" },
    "Unable to update notifications."
  );
}
