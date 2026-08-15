import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

type ProxyOptions = {
  method?: string;
  body?: BodyInit | null;
};

export async function proxyToBackend(
  request: NextRequest,
  backendPath: string,
  options: ProxyOptions = {}
): Promise<NextResponse> {
  try {
    const method = options.method ?? request.method;

    const headers = new Headers();

    const contentType = request.headers.get("content-type");
    if (contentType) {
      headers.set("content-type", contentType);
    }

    const accept = request.headers.get("accept");
    if (accept) {
      headers.set("accept", accept);
    }

    const cookie = request.headers.get("cookie");
    if (cookie) {
      headers.set("cookie", cookie);
    }

    const backendResponse = await fetch(
      `${BACKEND_URL}${backendPath}`,
      {
        method,
        headers,
        body: options.body,
        cache: "no-store",
        redirect: "manual",
      }
    );

    const responseBody =
      backendResponse.status === 204
        ? null
        : await backendResponse.text();

    const frontendResponse = new NextResponse(responseBody, {
      status: backendResponse.status,
    });

    const responseContentType =
      backendResponse.headers.get("content-type");

    if (responseContentType) {
      frontendResponse.headers.set(
        "content-type",
        responseContentType
      );
    }

    const setCookie =
      backendResponse.headers.get("set-cookie");

    if (setCookie) {
      frontendResponse.headers.set(
        "set-cookie",
        setCookie
      );
    }

    return frontendResponse;
  } catch (error) {
    console.error(
      `Backend proxy failed for ${backendPath}:`,
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