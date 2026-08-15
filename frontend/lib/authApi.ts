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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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

    throw new Error(
      getErrorMessage(
        errorBody,
        `Request failed with status ${response.status}`
      )
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

export type AdminApiResponse = {
  id: number;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
};

export function getCurrentAdmin() {
  return request<AdminApiResponse>("/auth/me");
}

export type UpdateAdminPayload = {
  full_name?: string;
  email?: string;
};

export function updateCurrentAdmin(
  data: UpdateAdminPayload
) {
  return request<AdminApiResponse>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
