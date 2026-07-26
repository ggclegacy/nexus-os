import { getTimePreferences } from "../../../../db/time-repository";
import { syncGoogleConnection } from "../../../../lib/server/google-calendar";
import { jsonError, readJson } from "../../../../lib/server/http";
import { ValidationError } from "../../../../lib/domain/validation";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as { connectionId?: unknown };
    if (typeof body.connectionId !== "string" || !body.connectionId) {
      throw new ValidationError("Calendar connection is required.");
    }
    const results = await syncGoogleConnection(
      body.connectionId,
      await getTimePreferences(),
    );
    return Response.json({ results });
  } catch (error) {
    return jsonError(error);
  }
}
