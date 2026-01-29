import { type NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "./lib/supabase/middleware";

// Protected routes that require authentication
const PROTECTED_ROUTES = [
  "/dashboard",
  "/upload",
  "/config",
  "/session",
  "/feedback",
  "/results",
  "/analytics",
];

// Auth routes that should redirect to dashboard if already logged in
const AUTH_ROUTES = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);

  // Refresh the auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Check if path is protected
  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Protected routes: redirect to /login if not authenticated
  if (isProtectedRoute) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Auth routes: redirect to /dashboard if already authenticated
  if (AUTH_ROUTES.includes(pathname)) {
    if (user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
