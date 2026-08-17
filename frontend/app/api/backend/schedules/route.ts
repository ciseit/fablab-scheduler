import { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/backendProxy";

export async function GET(request: NextRequest) {
  return proxyToBackend(
    request,
    "/schedules/",
    {
      method: "GET",
    }
  );
}

export async function POST(request: NextRequest) {
  const body = await request.text();

  return proxyToBackend(
    request,
    "/schedules/",
    {
      method: "POST",
      body,
    }
  );
}
