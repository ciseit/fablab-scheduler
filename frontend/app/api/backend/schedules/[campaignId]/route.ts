import { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/backendProxy";

type RouteContext = {
  params: Promise<{
    campaignId: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { campaignId } = await context.params;

  return proxyToBackend(
    request,
    `/schedules/${campaignId}`,
    {
      method: "GET",
    }
  );
}
