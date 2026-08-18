import { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/backendProxy";

type RouteContext = {
  params: Promise<{
    scheduleId: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const { scheduleId } = await context.params;

  return proxyToBackend(
    request,
    `/schedules/${scheduleId}/start-edit`,
    {
      method: "POST",
    }
  );
}
