import type { ShiftDay } from "@/lib/shiftApi";

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

export type AssignmentApiResponse = {
  id: number;
  campaign_id: number;
  shift_id: number;
  technician_id: number;
  status: string;
};

export type TechnicianHoursSummaryApiResponse = {
  technician_id: number;
  technician_name: string;
  assigned_hours: number;
  shortfall_hours: number;
};

export type UncoveredShiftApiResponse = {
  shift_id: number;
  day_of_week: ShiftDay;
  start_time: string;
  end_time: string;
  required_technicians: number;
  assigned_technicians: number;
  shortfall: number;
};

export type ScheduleApiResponse = {
  campaign_id: number;
  assignments: AssignmentApiResponse[];
  technicians_below_minimum: TechnicianHoursSummaryApiResponse[];
  uncovered_shifts: UncoveredShiftApiResponse[];
  published: boolean;
  public_token: string | null;
  minimum_weekly_hours: number;
};

export type PublicAssignmentApiResponse = {
  shift_id: number;
  day_of_week: ShiftDay;
  start_time: string;
  end_time: string;
  technician_name: string;
};

export type PublicTechnicianHoursApiResponse = {
  technician_name: string;
  assigned_hours: number;
};

export type PublicScheduleApiResponse = {
  campaign_name: string;
  semester: string;
  published_at: string;
  assignments: PublicAssignmentApiResponse[];
  technician_hours: PublicTechnicianHoursApiResponse[];
};

export function generateSchedule(campaignId: number) {
  return request<ScheduleApiResponse>(
    `/schedules/generate/${campaignId}`,
    { method: "POST" },
    "Unable to generate the schedule. Please try again."
  );
}

export function getSchedule(campaignId: number) {
  return request<ScheduleApiResponse>(
    `/schedules/${campaignId}`,
    {},
    "Unable to load the schedule. Please try again."
  );
}

export function editAssignment(
  assignmentId: number,
  technicianId: number
) {
  return request<AssignmentApiResponse>(
    `/schedules/assignments/${assignmentId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ technician_id: technicianId }),
    },
    "Unable to reassign this shift. Please try again."
  );
}

export function publishSchedule(campaignId: number) {
  return request<ScheduleApiResponse>(
    `/schedules/publish/${campaignId}`,
    { method: "POST" },
    "Unable to publish the schedule. Please try again."
  );
}

export function getPublicSchedule(publicToken: string) {
  return request<PublicScheduleApiResponse>(
    `/schedules/public/${encodeURIComponent(publicToken)}`,
    {},
    "Unable to load this published schedule."
  );
}
