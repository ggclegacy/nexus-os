import {
  createOAuthState,
  googleCalendarConfiguration,
} from "../../../../../lib/server/calendar-secrets";
import { googleAuthorizationUrl } from "../../../../../lib/server/google-calendar";
import { jsonError } from "../../../../../lib/server/http";

export async function GET(request: Request) {
  try {
    const configuration = googleCalendarConfiguration();
    if (!configuration.configured) {
      return Response.json(
        {
          error:
            configuration.reasonUnavailable ??
            "Google Calendar is not configured.",
        },
        { status: 503 },
      );
    }
    const requestUrl = new URL(request.url);
    const nonce = crypto.randomUUID();
    const redirectUri = `${requestUrl.origin}/api/calendar/google/callback`;
    const state = await createOAuthState({
      nonce,
      returnTo: "/calendar?view=day&integration=google",
      expiresAt: Date.now() + 10 * 60_000,
    });
    const response = Response.redirect(
      googleAuthorizationUrl({ redirectUri, state }),
      302,
    );
    response.headers.append(
      "Set-Cookie",
      [
        `nexus_oauth_nonce=${encodeURIComponent(nonce)}`,
        "HttpOnly",
        "SameSite=Lax",
        "Path=/api/calendar/google/callback",
        "Max-Age=600",
        requestUrl.protocol === "https:" ? "Secure" : "",
      ]
        .filter(Boolean)
        .join("; "),
    );
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
