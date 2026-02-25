import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Dashboard middleware: NextAuth JWT authentication + RBAC + CORS
 *
 * Public paths: /login, /api/auth/*
 * Authenticated pages redirect to /login if no valid JWT
 * Authenticated API routes return 401 if no valid JWT
 * Viewer role cannot use POST/PUT/DELETE on non-auth API routes
 */

const PUBLIC_PATHS = ["/login", "/api/auth"];
const WRITE_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

function addCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CORS preflight for API routes
  if (pathname.startsWith("/api/") && request.method === "OPTIONS") {
    return addCorsHeaders(new NextResponse(null, { status: 204 }));
  }

  // Public paths: no auth required
  if (isPublicPath(pathname)) {
    const response = NextResponse.next();
    if (pathname.startsWith("/api/")) {
      addCorsHeaders(response);
    }
    return response;
  }

  // Check JWT token
  const token = await getToken({ req: request });

  if (!token) {
    // API routes: 401
    if (pathname.startsWith("/api/")) {
      return addCorsHeaders(
        new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      );
    }
    // Pages: redirect to login (use pathname to avoid localhost in callbackUrl behind proxy)
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // RBAC: viewer cannot write via API
  if (
    pathname.startsWith("/api/") &&
    WRITE_METHODS.has(request.method) &&
    token.role === "viewer"
  ) {
    return addCorsHeaders(
      new NextResponse(JSON.stringify({ error: "Forbidden: viewer role cannot modify data" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    );
  }

  // Authenticated: proceed
  const response = NextResponse.next();
  if (pathname.startsWith("/api/")) {
    addCorsHeaders(response);
  }
  return response;
}

export const config = {
  matcher: [
    // Match all routes except Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
