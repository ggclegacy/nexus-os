import { getTimePreferences } from "../../../../../db/time-repository";
import { addDays, localDateInZone } from "../../../../../lib/time/rules";
import { ValidationError } from "../../../../../lib/domain/validation";
import { atlasAnswer } from "../../../../../lib/server/atlas-calendar";
import { permittedAtlasEvents } from "../../../../../lib/server/calendar-intelligence-service";
import { jsonError, readJson } from "../../../../../lib/server/http";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as { query?: unknown };
    if (
      typeof body.query !== "string" ||
      !body.query.trim() ||
      body.query.length > 500
    ) {
      throw new ValidationError(
        "Ask a calendar question in 500 characters or fewer.",
      );
    }
    const preferences = await getTimePreferences();
    const today = localDateInZone(new Date(), preferences.timeZone);
    const events = await permittedAtlasEvents(
      addDays(today, -90),
      addDays(today, 365),
    );
    const answer = await atlasAnswer(
      body.query.trim(),
      events,
      preferences,
    );
    return Response.json({ answer });
  } catch (error) {
    return jsonError(error);
  }
}
