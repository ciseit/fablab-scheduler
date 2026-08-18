import { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/backendProxy";

type RouteContext = {
  params: Promise<{
    shiftId: string;
  }>;
};

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const { shiftId } = await context.params;

  return proxyToBackend(
    request,
    `/shifts/${shiftId}`,
    {
      method: "DELETE",
    }
  );
}
