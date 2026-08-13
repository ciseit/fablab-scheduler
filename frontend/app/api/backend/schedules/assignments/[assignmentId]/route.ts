import { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/backendProxy";

type RouteContext = {
  params: Promise<{
    assignmentId: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const { assignmentId } = await context.params;
  const body = await request.text();

  return proxyToBackend(
    request,
    `/schedules/assignments/${assignmentId}`,
    {
      method: "PATCH",
      body,
    }
  );
}
