import { NextRequest, NextResponse } from "next/server";

/**
 * Dashboard middleware: Basic Authentication + CORS
 *
 * Auth is enforced on all routes when DASHBOARD_USER and DASHBOARD_PASSWORD
 * environment variables are set. When either is unset, auth is bypassed
 * (local development mode).
 */

function checkBasicAuth(request: NextRequest): NextResponse | null {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASSWORD;

  // Skip auth if credentials not configured (dev mode)
  if (!user || !pass) return null;

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="AI Influencer Dashboard"',
      },
    });
  }

  const base64 = authHeader.slice(6);
  let decoded: string;
  try {
    decoded = atob(base64);
  } catch {
    return new NextResponse("Invalid credentials", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="AI Influencer Dashboard"',
      },
    });
  }

  const [inputUser, ...passParts] = decoded.split(":");
  const inputPass = passParts.join(":");

  if (inputUser !== user || inputPass !== pass) {
    return new NextResponse("Invalid credentials", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="AI Influencer Dashboard"',
      },
    });
  }

  return null; // Auth passed
}

export function middleware(request: NextRequest) {
  // 1. Basic Auth check (all routes)
  const authResponse = checkBasicAuth(request);
  if (authResponse) return authResponse;

  // 2. CORS headers for API routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const response = NextResponse.next();

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

    // Handle preflight requests
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: response.headers,
      });
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
