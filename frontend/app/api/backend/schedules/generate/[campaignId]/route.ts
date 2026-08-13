import { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/backendProxy";

type RouteContext = {
  params: Promise<{
    campaignId: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const { campaignId } = await context.params;

  return proxyToBackend(
    request,
    `/schedules/generate/${campaignId}`,
    {
      method: "POST",
    }
  );
}
