import { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/backendProxy";

type RouteContext = {
  params: Promise<{
    locationId: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const { locationId } = await context.params;
  const body = await request.text();

  return proxyToBackend(
    request,
    `/locations/${locationId}`,
    {
      method: "PATCH",
      body,
    }
  );
}
