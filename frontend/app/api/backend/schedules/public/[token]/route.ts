import { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/backendProxy";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { token } = await context.params;

  return proxyToBackend(
    request,
    `/schedules/public/${encodeURIComponent(token)}`,
    {
      method: "GET",
    }
  );
}
