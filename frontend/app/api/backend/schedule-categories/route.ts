import { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/backendProxy";

export async function GET(request: NextRequest) {
  return proxyToBackend(
    request,
    "/schedule-categories/",
    {
      method: "GET",
    }
  );
}

export async function POST(request: NextRequest) {
  const body = await request.text();

  return proxyToBackend(
    request,
    "/schedule-categories/",
    {
      method: "POST",
      body,
    }
  );
}
