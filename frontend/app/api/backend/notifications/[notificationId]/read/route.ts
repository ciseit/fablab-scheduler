import { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/backendProxy";

type RouteContext = {
  params: Promise<{
    notificationId: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const { notificationId } = await context.params;

  return proxyToBackend(
    request,
    `/notifications/${notificationId}/read`,
    {
      method: "POST",
    }
  );
}
