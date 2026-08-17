const API_URL = "/api/backend";

export type AvailabilityType =
  | "preferred"
  | "available"
  | "backup"
  | "restricted";

export type AvailabilityDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type PublicAvailabilityBlock = {
  day_of_week: AvailabilityDay;
  start_time: string;
  end_time: string;
  availability_type: AvailabilityType;
};

export type PublicAvailabilitySubmission = {
  email: string;
  availability_blocks: PublicAvailabilityBlock[];
  replace_existing?: boolean;
};

export type AvailabilityResponse = {
  id: number;
  technician_id: number;
  campaign_id: number;
  day_of_week: AvailabilityDay;
  start_time: string;
  end_time: string;
  availability_type: AvailabilityType;
};

type BackendErrorBody = {
  detail?: string | Array<{
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

export async function submitPublicAvailability(
  publicToken: string,
  data: PublicAvailabilitySubmission
): Promise<AvailabilityResponse[]> {
  const response = await fetch(
    `${API_URL}/availability/public/${encodeURIComponent(publicToken)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    let errorBody: BackendErrorBody | null = null;

    try {
      errorBody = (await response.json()) as BackendErrorBody;
    } catch {
      errorBody = null;
    }

    const fallbackMessage =
      response.status === 404
        ? "The availability request or technician email could not be found."
        : response.status === 409
          ? "This availability has already been submitted."
          : response.status === 422
            ? "Some availability information is invalid."
            : "Unable to submit availability. Please try again.";

    throw new Error(
      getErrorMessage(errorBody, fallbackMessage)
    );
  }

  return response.json() as Promise<AvailabilityResponse[]>;
}