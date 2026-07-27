import { updateCalendarSource } from "../../../../../db/calendar-intelligence-repository";
import { ValidationError } from "../../../../../lib/domain/validation";
import { jsonError, readJson } from "../../../../../lib/server/http";

interface Context {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = (await readJson(request)) as Record<string, unknown>;
    const update: Record<string, boolean> = {};
    for (const key of [
      "visible",
      "includeInAvailability",
      "includeInAtlas",
      "isDefault",
    ]) {
      if (body[key] === undefined) continue;
      if (typeof body[key] !== "boolean") {
        throw new ValidationError(`${key} must be true or false.`);
      }
      update[key] = body[key] as boolean;
    }
    const source = await updateCalendarSource(id, update);
    if (!source) {
      return Response.json(
        { error: "Calendar source not found." },
        { status: 404 },
      );
    }
    return Response.json({ source });
  } catch (error) {
    return jsonError(error);
  }
}
