import { getTimePreferences } from "../../../../../db/time-repository";
import { verifyOAuthState } from "../../../../../lib/server/calendar-secrets";
import {
  connectGoogleCalendar,
  exchangeGoogleAuthorizationCode,
} from "../../../../../lib/server/google-calendar";

function cookie(request: Request, name: string) {
  const values = request.headers.get("cookie")?.split(";") ?? [];
  for (const value of values) {
    const [key, ...rest] = value.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function redirect(
  origin: string,
  status: "connected" | "denied" | "failed",
  returnTo = "/calendar?view=day",
) {
  const target = new URL(returnTo, origin);
  target.searchParams.set("google", status);
  const response = Response.redirect(target, 302);
  response.headers.append(
    "Set-Cookie",
    "nexus_oauth_nonce=; HttpOnly; SameSite=Lax; Path=/api/calendar/google/callback; Max-Age=0",
  );
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    if (url.searchParams.get("error")) {
      return redirect(url.origin, "denied");
    }
    const stateValue = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    if (!stateValue || !code) return redirect(url.origin, "failed");
    const state = await verifyOAuthState(stateValue);
    if (cookie(request, "nexus_oauth_nonce") !== state.nonce) {
      return redirect(url.origin, "failed", state.returnTo);
    }
    const token = await exchangeGoogleAuthorizationCode({
      code,
      redirectUri: `${url.origin}/api/calendar/google/callback`,
    });
    await connectGoogleCalendar({
      token,
      preferences: await getTimePreferences(),
    });
    return redirect(url.origin, "connected", state.returnTo);
  } catch {
    return redirect(url.origin, "failed");
  }
}
