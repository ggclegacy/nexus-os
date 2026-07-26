import { NextResponse, type NextRequest } from "next/server";
import { authorizePrivateRequest } from "./lib/server/access";

const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; manifest-src 'self'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy":
    "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
} as const;

function secure(response: NextResponse) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}

export function proxy(request: NextRequest) {
  const decision = authorizePrivateRequest(request, {
    NEXUS_ACCESS_USERNAME: process.env.NEXUS_ACCESS_USERNAME,
    NEXUS_ACCESS_PASSWORD: process.env.NEXUS_ACCESS_PASSWORD,
  });
  if (decision.state === "allowed") {
    return secure(NextResponse.next());
  }

  const apiRequest = request.nextUrl.pathname.startsWith("/api/");
  const message =
    decision.state === "configuration-required"
      ? "Private access is not configured."
      : decision.state === "forbidden"
        ? "This request is not allowed."
        : "Authentication is required.";
  const response = apiRequest
    ? NextResponse.json(
        { error: message },
        {
          status:
            decision.state === "configuration-required"
              ? 503
              : decision.state === "forbidden"
                ? 403
                : 401,
        },
      )
    : new NextResponse(message, {
        status:
          decision.state === "configuration-required"
            ? 503
            : decision.state === "forbidden"
              ? 403
              : 401,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
  if (decision.state === "unauthorized") {
    response.headers.set("WWW-Authenticate", 'Basic realm="Nexus OS"');
  }
  return secure(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|nexus-emblem-96.png|nexus-emblem-192.png).*)",
  ],
};
