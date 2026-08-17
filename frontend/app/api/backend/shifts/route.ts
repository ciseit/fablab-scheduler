import { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/backendProxy";

export async function GET(request: NextRequest) {
  const scheduleId = request.nextUrl.searchParams.get(
    "schedule_id"
  );

  const query = scheduleId
    ? `?schedule_id=${encodeURIComponent(scheduleId)}`
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
