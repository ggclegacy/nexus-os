import {
  getTimePreferences,
  updateTimePreferences,
} from "../../../../db/time-repository";
import { parseTimePreferences } from "../../../../lib/time/validation";
import { jsonError, readJson } from "../../../../lib/server/http";

export async function GET() {
  try {
    return Response.json({ preferences: await getTimePreferences() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const preferences = await updateTimePreferences(
      parseTimePreferences(await readJson(request)),
    );
    return Response.json({ preferences });
  } catch (error) {
    return jsonError(error);
  }
}
