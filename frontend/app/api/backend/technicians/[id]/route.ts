import { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/backendProxy";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  const body = await request.text();

  return proxyToBackend(
    request,
    `/technicians/${id}`,
    {
      method: "PATCH",
      body,
    }
  );
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;

  return proxyToBackend(
    request,
    `/technicians/${id}`,
    {
      method: "DELETE",
    }
  );
}