import { type NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "./lib/supabase/middleware";

// Routes requiring authentication
const PROTECTED_ROUTES = [
  "/dashboard",
  "/upload",
  "/session",
  "/results",
  "/settings",
  "/onboarding",
];

// Auth routes — redirect to dashboard when already logged in
const AUTH_ROUTES = ["/login", "/signup"];

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

export default async function proxy(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);

  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    // Auth refresh failed (network, expired refresh token, etc.) — treat as unauthenticated.
  }

  const { pathname } = request.nextUrl;

  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isProtectedRoute && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (AUTH_ROUTES.includes(pathname) && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}
