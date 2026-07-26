export type AccessDecision =
  | { state: "allowed" }
  | { state: "configuration-required" }
  | { state: "forbidden" }
  | { state: "unauthorized" };

interface AccessEnvironment {
  NEXUS_ACCESS_PASSWORD?: string;
  NEXUS_ACCESS_USERNAME?: string;
}

function localHostname(hostname: string) {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}

function requestOrigin(request: Pick<Request, "headers" | "url">) {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (request.headers.get("host") ?? forwardedHost ?? url.host)
    .split(",")[0]
    .trim();
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim();
  const protocol = forwardedProtocol ?? url.protocol.replace(":", "");
  return new URL(`${protocol}://${host}`);
}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function basicCredentials(value: string | null) {
  if (!value?.startsWith("Basic ")) return null;
  try {
    const decoded = atob(value.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

export function authorizePrivateRequest(
  request: Pick<Request, "headers" | "method" | "url">,
  environment: AccessEnvironment,
): AccessDecision {
  const origin = requestOrigin(request);
  if (localHostname(origin.hostname)) return { state: "allowed" };

  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite === "cross-site") return { state: "forbidden" };
    const requestOriginHeader = request.headers.get("origin");
    if (requestOriginHeader && requestOriginHeader !== origin.origin) {
      return { state: "forbidden" };
    }
  }

  const expectedUsername = environment.NEXUS_ACCESS_USERNAME;
  const expectedPassword = environment.NEXUS_ACCESS_PASSWORD;
  if (!expectedUsername || !expectedPassword) {
    return { state: "configuration-required" };
  }

  const credentials = basicCredentials(request.headers.get("authorization"));
  if (
    !credentials ||
    !constantTimeEqual(credentials.username, expectedUsername) ||
    !constantTimeEqual(credentials.password, expectedPassword)
  ) {
    return { state: "unauthorized" };
  }
  return { state: "allowed" };
}
