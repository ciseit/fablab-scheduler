import { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/backendProxy";

type RouteContext = {
  params: Promise<{
    campaignId: string;
  }>;
};

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const { campaignId } = await context.params;

  return proxyToBackend(
    request,
    `/collection-campaigns/${campaignId}`,
    {
      method: "DELETE",
    }
  );
}
