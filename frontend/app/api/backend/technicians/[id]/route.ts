import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = "http://127.0.0.1:8000";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const response = await fetch(
      `${BACKEND_URL}/technicians/${id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("Technician PATCH proxy failed:", error);

    return NextResponse.json(
      {
        detail: "Unable to update technician.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const response = await fetch(
      `${BACKEND_URL}/technicians/${id}`,
      {
        method: "DELETE",
      }
    );

    if (response.status === 204) {
      return new NextResponse(null, {
        status: 204,
      });
    }

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("Technician DELETE proxy failed:", error);

    return NextResponse.json(
      {
        detail: "Unable to delete technician.",
      },
      {
        status: 500,
      }
    );
  }
}