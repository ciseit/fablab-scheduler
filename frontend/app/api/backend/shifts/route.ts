import { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/backendProxy";

export async function GET(request: NextRequest) {
  const campaignId = request.nextUrl.searchParams.get(
    "campaign_id"
  );

  const query = campaignId
    ? `?campaign_id=${encodeURIComponent(campaignId)}`
    : "";

  return proxyToBackend(request, `/shifts/${query}`, {
    method: "GET",
  });
}

export async function POST(request: NextRequest) {
  const body = await request.text();

  return proxyToBackend(request, "/shifts/", {
    method: "POST",
    body,
  });
}
