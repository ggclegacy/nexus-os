import { ValidationError } from "../domain/validation";

export async function readJson(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ValidationError("Request must contain JSON.");
  }
  return request.json();
}

export function jsonError(error: unknown) {
  if (error instanceof ValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  const message =
    error instanceof Error
      ? error.message
      : "The request could not be completed.";
  const status = message.includes("before adding another") ? 409 : 500;
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
