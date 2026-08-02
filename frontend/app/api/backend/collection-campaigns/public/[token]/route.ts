import { NextResponse } from "next/server";

const BACKEND_URL = "http://127.0.0.1:8000";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const { token } = await context.params;

    const response = await fetch(
      `${BACKEND_URL}/collection-campaigns/public/${token}`,
      {
        cache: "no-store",
      }
    );

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error(
      "Availability Request Public GET proxy failed:",
      error
    );

    return NextResponse.json(
      {
        detail: "Unable to connect to backend.",
      },
      {
        status: 500,
      }
    );
  }
}