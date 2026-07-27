import { NextResponse, type NextRequest } from "next/server";
import { authorizeRequest } from "./lib/server/access";

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
  const decision = authorizeRequest(request);
  if (decision.state === "allowed") {
    return secure(NextResponse.next());
  }

  const apiRequest = request.nextUrl.pathname.startsWith("/api/");
  const message = "This request is not allowed.";
  const response = apiRequest
    ? NextResponse.json(
        { error: message },
        {
          status: 403,
        },
      )
    : new NextResponse(message, {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
  return secure(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|nexus-emblem-96.png|nexus-emblem-192.png).*)",
  ],
};
