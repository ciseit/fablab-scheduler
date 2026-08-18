import { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/backendProxy";

export async function GET(request: NextRequest) {
  const includeInactive = request.nextUrl.searchParams.get(
    "include_inactive"
  );

  const query = includeInactive ? "?include_inactive=true" : "";

  return proxyToBackend(
    request,
    `/locations/${query}`,
    {
      method: "GET",
    }
  );
}

export async function POST(request: NextRequest) {
  const body = await request.text();

  return proxyToBackend(
    request,
    "/locations/",
    {
      method: "POST",
      body,
    }
  );
}
