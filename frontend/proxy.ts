import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "fablab_admin_session";

const protectedRoutes = [
  "/dashboard",
  "/technicians",
  "/availability-requests",
  "/schedule-builder",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedRoute = protectedRoutes.some(
    (route) =>
      pathname === route ||
      pathname.startsWith(`${route}/`)
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  const sessionCookie =
    request.cookies.get(AUTH_COOKIE_NAME);

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);

    loginUrl.searchParams.set(
      "next",
      pathname
    );

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/technicians/:path*",
    "/availability-requests/:path*",
    "/schedule-builder/:path*",
  ],
};