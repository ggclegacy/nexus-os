import { ValidationError } from "../../../../../lib/domain/validation";
import { resolveGoogleSyncConflict } from "../../../../../lib/server/google-calendar";
import { jsonError, readJson } from "../../../../../lib/server/http";
import { parseCalendarEvent } from "../../../../../lib/time/validation";

interface Context {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = (await readJson(request)) as {
      resolution?: unknown;
      event?: unknown;
    };
    if (!["nexus", "provider", "merged"].includes(String(body.resolution))) {
      throw new ValidationError("Sync conflict resolution is invalid.");
    }
    const resolution = body.resolution as "nexus" | "provider" | "merged";
    const merged =
      resolution === "merged" ? parseCalendarEvent(body.event) : undefined;
    const event = await resolveGoogleSyncConflict(id, resolution, merged);
    return Response.json({ event, resolution });
  } catch (error) {
    return jsonError(error);
  }
}
