import { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/backendProxy";

type RouteContext = {
  params: Promise<{
    scheduleId: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { scheduleId } = await context.params;

  return proxyToBackend(
    request,
    `/schedules/${scheduleId}`,
    {
      method: "GET",
    }
  );
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const { scheduleId } = await context.params;
  const body = await request.text();

  return proxyToBackend(
    request,
    `/schedules/${scheduleId}`,
    {
      method: "PATCH",
      body,
    }
  );
}
