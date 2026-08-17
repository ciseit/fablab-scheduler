import { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/backendProxy";

type RouteContext = {
  params: Promise<{
    categoryId: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const { categoryId } = await context.params;
  const body = await request.text();

  return proxyToBackend(
    request,
    `/schedule-categories/${categoryId}`,
    {
      method: "PATCH",
      body,
    }
  );
}
