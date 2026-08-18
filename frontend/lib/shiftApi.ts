const API_URL = "/api/backend";

type BackendErrorBody = {
  detail?:
    | string
    | Array<{
        loc?: Array<string | number>;
        msg?: string;
        type?: string;
      }>;
};

function getErrorMessage(
  errorBody: BackendErrorBody | null,
  fallbackMessage: string
) {
  if (!errorBody?.detail) {
    return fallbackMessage;
  }

  if (typeof errorBody.detail === "string") {
    return errorBody.detail;
  }

  if (Array.isArray(errorBody.detail)) {
    const messages = errorBody.detail
      .map((item) => item.msg)
      .filter((message): message is string => Boolean(message));

    if (messages.length > 0) {
      return messages.join(" ");
    }
  }

  return fallbackMessage;
}

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

    throw new Error(getErrorMessage(errorBody, fallbackMessage));
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

export type ShiftDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type ShiftApiResponse = {
  id: number;
  schedule_id: number;
  location_id: number | null;
  day_of_week: ShiftDay;
  start_time: string;
  end_time: string;
  required_technicians: number;
};

export type ShiftCreatePayload = {
  schedule_id: number;
  location_id?: number | null;
  day_of_week: ShiftDay;
  start_time: string;
  end_time: string;
  required_technicians: number;
};

export function getShifts(scheduleId: number) {
  return request<ShiftApiResponse[]>(
    `/shifts?schedule_id=${scheduleId}`,
    {},
    "Unable to load shifts. Please try again."
  );
}

export function createShift(data: ShiftCreatePayload) {
  return request<ShiftApiResponse>(
    "/shifts",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    "Unable to create the shift. Please try again."
  );
}

export function deleteShift(shiftId: number) {
  return request<null>(
    `/shifts/${shiftId}`,
    { method: "DELETE" },
    "Unable to delete this shift. Please try again."
  );
}
