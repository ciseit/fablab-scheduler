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

async function request(path: string, options: RequestInit = {}) {
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
    return null;
  }

  return response.json();
}

export function getTechnicians() {
  return request("/technicians/");
}

export function createTechnician(data: unknown) {
  return request("/technicians/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTechnician(id: number, data: unknown) {
  return request(`/technicians/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteTechnician(id: number) {
  return request(`/technicians/${id}`, {
    method: "DELETE",
  });
}