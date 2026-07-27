export type AccessDecision = { state: "allowed" } | { state: "forbidden" };

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

export function authorizeRequest(
  request: Pick<Request, "headers" | "method" | "url">,
): AccessDecision {
  const origin = requestOrigin(request);

  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite === "cross-site") return { state: "forbidden" };
    const requestOriginHeader = request.headers.get("origin");
    if (requestOriginHeader && requestOriginHeader !== origin.origin) {
      return { state: "forbidden" };
    }
  }

  return { state: "allowed" };
}
