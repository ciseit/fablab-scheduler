import { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/backendProxy";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

async function handleRequest(
  request: NextRequest,
  context: RouteContext
) {
  const { path } = await context.params;

  const backendPath = `/auth/${path.join("/")}`;

  const body =
    request.method === "GET" ||
    request.method === "HEAD" ||
    request.method === "DELETE"
      ? null
      : await request.text();

  return proxyToBackend(request, backendPath, {
    method: request.method,
    body,
  });
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  return handleRequest(request, context);
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  return handleRequest(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  return handleRequest(request, context);
}