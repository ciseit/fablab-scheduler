const API_URL = "/api/backend";

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
    const errorText = await response.text();

    throw new Error(
      errorText ||
        `Request failed with status ${response.status}`
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

export type SubmissionSummaryResponse = {
  campaign_id: number;
  unique_technicians_submitted: number;
  total_technicians: number;
  total_availability_blocks: number;
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