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

export type ScheduleApiResponse = {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  semester: string | null;
  notes: string | null;
  minimum_weekly_hours: number;
  campaign_id: number | null;
  status: string;
  published_at: string | null;
  public_token: string | null;
  // Set only on a working copy created via "Edit Published Schedule";
  // points back at the published schedule it was cloned from.
  editing_source_id: number | null;
};

export type ScheduleListApiResponse = ScheduleApiResponse & {
  campaign_name: string | null;
  shift_count: number;
  assignment_count: number;
};

export type CreateSchedulePayload = {
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  semester?: string | null;
  notes?: string | null;
  minimum_weekly_hours: number;
  campaign_id?: number | null;
};

export type AssignmentApiResponse = {
  id: number;
  schedule_id: number;
  shift_id: number;
  technician_id: number;
  status: string;
  category_id: number | null;
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

export type ScheduleBoardApiResponse = {
  schedule_id: number;
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
  location_name: string | null;
  category_name: string | null;
  category_color: string | null;
};

export type PublicTechnicianHoursApiResponse = {
  technician_name: string;
  assigned_hours: number;
};

export type PublicScheduleApiResponse = {
  schedule_name: string;
  semester: string | null;
  published_at: string;
  assignments: PublicAssignmentApiResponse[];
  technician_hours: PublicTechnicianHoursApiResponse[];
};

export function getSchedules() {
  return request<ScheduleListApiResponse[]>(
    "/schedules/",
    {},
    "Unable to load schedules. Please try again."
  );
}

export function createSchedule(data: CreateSchedulePayload) {
  return request<ScheduleApiResponse>(
    "/schedules/",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    "Unable to create the schedule. Please try again."
  );
}

export function updateSchedule(
  scheduleId: number,
  data: Partial<CreateSchedulePayload>
) {
  return request<ScheduleApiResponse>(
    `/schedules/${scheduleId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
    "Unable to update the schedule. Please try again."
  );
}

export function deleteSchedule(scheduleId: number) {
  return request<null>(
    `/schedules/${scheduleId}`,
    { method: "DELETE" },
    "Unable to delete this schedule. Please try again."
  );
}

export function startEditingPublishedSchedule(scheduleId: number) {
  return request<ScheduleApiResponse>(
    `/schedules/${scheduleId}/start-edit`,
    { method: "POST" },
    "Unable to start editing this published schedule. Please try again."
  );
}

export function unassign(assignmentId: number) {
  return request<null>(
    `/schedules/assignments/${assignmentId}`,
    { method: "DELETE" },
    "Unable to unassign this technician. Please try again."
  );
}

export function generateSchedule(scheduleId: number) {
  return request<ScheduleBoardApiResponse>(
    `/schedules/generate/${scheduleId}`,
    { method: "POST" },
    "Unable to generate the schedule. Please try again."
  );
}

export function getScheduleBoard(scheduleId: number) {
  return request<ScheduleBoardApiResponse>(
    `/schedules/${scheduleId}`,
    {},
    "Unable to load the schedule. Please try again."
  );
}

export function createAssignment(
  scheduleId: number,
  data: { shift_id: number; technician_id: number; category_id?: number | null }
) {
  return request<AssignmentApiResponse>(
    `/schedules/${scheduleId}/assignments`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    "Unable to assign this technician. Please try again."
  );
}

export function editAssignment(
  assignmentId: number,
  data: {
    technician_id?: number;
    category_id?: number | null;
    clear_category?: boolean;
  }
) {
  return request<AssignmentApiResponse>(
    `/schedules/assignments/${assignmentId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
    "Unable to update this assignment. Please try again."
  );
}

export function publishSchedule(scheduleId: number) {
  return request<ScheduleBoardApiResponse>(
    `/schedules/publish/${scheduleId}`,
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
