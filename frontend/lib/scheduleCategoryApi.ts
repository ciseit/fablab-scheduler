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

export type ScheduleCategoryApiResponse = {
  id: number;
  name: string;
  color: string;
  is_active: boolean;
};

export function getScheduleCategories(includeInactive = false) {
  return request<ScheduleCategoryApiResponse[]>(
    `/schedule-categories/${includeInactive ? "?include_inactive=true" : ""}`,
    {},
    "Unable to load categories."
  );
}

export function createScheduleCategory(name: string, color: string) {
  return request<ScheduleCategoryApiResponse>(
    "/schedule-categories/",
    {
      method: "POST",
      body: JSON.stringify({ name, color }),
    },
    "Unable to create this category."
  );
}

export function updateScheduleCategory(
  categoryId: number,
  data: { name?: string; color?: string; is_active?: boolean }
) {
  return request<ScheduleCategoryApiResponse>(
    `/schedule-categories/${categoryId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
    "Unable to update this category."
  );
}
