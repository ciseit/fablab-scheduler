const API_URL = "/api/backend";

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorMessage = await response.text();

    throw new Error(
      errorMessage || `Request failed with status ${response.status}`
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