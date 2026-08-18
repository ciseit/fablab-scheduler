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

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

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
  options: RequestInit = {}
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

    throw new ApiError(
      getErrorMessage(
        errorBody,
        `Request failed with status ${response.status}`
      ),
      response.status
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

export type AvailabilityRequestApiResponse = {
  id: number;
  name: string;
  semester: string;
  opens_at: string;
  closes_at: string;
  minimum_weekly_hours: number;
  public_token: string;
  status: string;
  is_accepting_submissions: boolean;
  has_opened: boolean;

  submitted_count?: number;
  total_technicians?: number;
  total_availability_blocks?: number;
};

export type CreateAvailabilityRequestPayload = {
  name: string;
  semester: string;
  opens_at: string;
  closes_at: string;
  minimum_weekly_hours: number;
};

export type UpdateAvailabilityRequestPayload = Partial<
  CreateAvailabilityRequestPayload
> & {
  status?: string;
};

export type SubmissionSummaryResponse = {
  campaign_id: number;
  unique_technicians_submitted: number;
  total_technicians: number;
  total_availability_blocks: number;
};

export type TechnicianSubmissionStatus = {
  technician_id: number;
  technician_name: string;
  submitted: boolean;
  submitted_at: string | null;
};

export type SubmissionRosterResponse = {
  campaign_id: number;
  submitted: TechnicianSubmissionStatus[];
  pending: TechnicianSubmissionStatus[];
};

export function getAvailabilityRequests() {
  return request<AvailabilityRequestApiResponse[]>(
    "/collection-campaigns/"
  );
}

export function createAvailabilityRequest(
  data: CreateAvailabilityRequestPayload
) {
  return request<AvailabilityRequestApiResponse>(
    "/collection-campaigns/",
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export function getAvailabilityRequestByToken(
  token: string
) {
  const encodedToken = encodeURIComponent(token);

  return request<AvailabilityRequestApiResponse>(
    `/collection-campaigns/public/${encodedToken}`
  );
}

export function getAvailabilitySubmissionSummary(
  campaignId: number
) {
  return request<SubmissionSummaryResponse>(
    `/collection-campaigns/${campaignId}/submission-summary`
  );
}

export function updateAvailabilityRequest(
  campaignId: number,
  data: UpdateAvailabilityRequestPayload
) {
  return request<AvailabilityRequestApiResponse>(
    `/collection-campaigns/${campaignId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
}

export function deleteAvailabilityRequest(campaignId: number) {
  return request<null>(`/collection-campaigns/${campaignId}`, {
    method: "DELETE",
  });
}

// Archiving preserves the request (and the submissions/schedules that
// block a hard delete) while taking it out of the active list.
export function archiveAvailabilityRequest(campaignId: number) {
  return updateAvailabilityRequest(campaignId, {
    status: "archived",
  });
}

export function getAvailabilityRequestRoster(campaignId: number) {
  return request<SubmissionRosterResponse>(
    `/collection-campaigns/${campaignId}/roster`
  );
}