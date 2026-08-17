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

export type LocationApiResponse = {
  id: number;
  name: string;
  is_active: boolean;
};

export function getLocations() {
  return request<LocationApiResponse[]>(
    "/locations/",
    {},
    "Unable to load locations."
  );
}

export function createLocation(name: string) {
  return request<LocationApiResponse>(
    "/locations/",
    {
      method: "POST",
      body: JSON.stringify({ name }),
    },
    "Unable to create this location."
  );
}

export function updateLocation(
  locationId: number,
  data: { name?: string; is_active?: boolean }
) {
  return request<LocationApiResponse>(
    `/locations/${locationId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
    "Unable to update this location."
  );
}
