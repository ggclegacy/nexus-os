import { ValidationError } from "../domain/validation";
import { ConflictError, ForbiddenError } from "../domain/errors";

const MAX_JSON_BYTES = 65_536;

export async function readJson(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ValidationError("Request must contain JSON.");
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_JSON_BYTES) {
    throw new ValidationError("Request body is too large.");
  }
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_JSON_BYTES) {
    throw new ValidationError("Request body is too large.");
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new ValidationError("Request body contains invalid JSON.");
  }
}

export function requestId(request: Request) {
  const value = request.headers.get("idempotency-key");
  if (value === null) return crypto.randomUUID();
  if (!/^[A-Za-z0-9:_-]{16,160}$/.test(value)) {
    throw new ValidationError("Idempotency key is invalid.");
  }
  return value;
}

export function jsonError(error: unknown) {
  if (error instanceof ValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ConflictError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof ForbiddenError) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  const message =
    error instanceof Error
      ? error.message
      : "The request could not be completed.";
  const status =
    message.includes("top priority") || message.includes("promoting another")
      ? 409
      : 500;
  return Response.json(
    {
      error:
        status === 500
          ? "The request could not be completed. Try again."
          : message,
    },
    { status },
  );
}
