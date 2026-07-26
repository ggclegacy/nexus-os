import {
  updateCalendarPrivacySettings,
} from "../../../../db/calendar-intelligence-repository";
import { ValidationError } from "../../../../lib/domain/validation";
import { calendarIntelligencePayload } from "../../../../lib/server/calendar-intelligence-service";
import { jsonError, readJson } from "../../../../lib/server/http";

export async function GET() {
  try {
    return Response.json(await calendarIntelligencePayload(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await readJson(request)) as Record<string, unknown>;
    const booleans = [
      "sensitiveEventsInAtlas",
      "patternInsights",
      "semanticSearch",
      "immediateCreateWithUndo",
    ] as const;
    for (const key of booleans) {
      if (typeof body[key] !== "boolean") {
        throw new ValidationError(`${key} must be true or false.`);
      }
    }
    if (!["remove", "snapshot"].includes(String(body.disconnectedDataRetention))) {
      throw new ValidationError("Disconnected data retention is invalid.");
    }
    const privacy = await updateCalendarPrivacySettings({
      sensitiveEventsInAtlas: body.sensitiveEventsInAtlas as boolean,
      patternInsights: body.patternInsights as boolean,
      semanticSearch: body.semanticSearch as boolean,
      immediateCreateWithUndo: body.immediateCreateWithUndo as boolean,
      disconnectedDataRetention: body.disconnectedDataRetention as
        | "remove"
        | "snapshot",
    });
    return Response.json({ privacy });
  } catch (error) {
    return jsonError(error);
  }
}
