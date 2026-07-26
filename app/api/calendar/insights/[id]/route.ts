import { setInsightPreference } from "../../../../../db/calendar-intelligence-repository";
import { ValidationError } from "../../../../../lib/domain/validation";
import { jsonError, readJson } from "../../../../../lib/server/http";

interface Context {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = (await readJson(request)) as Record<string, unknown>;
    if (body.action !== "dismiss" && body.action !== "mute") {
      throw new ValidationError("Insight action is invalid.");
    }
    await setInsightPreference(id, {
      dismissed: body.action === "dismiss" ? true : undefined,
      muted: body.action === "mute" ? true : undefined,
    });
    return Response.json({ updated: true });
  } catch (error) {
    return jsonError(error);
  }
}
