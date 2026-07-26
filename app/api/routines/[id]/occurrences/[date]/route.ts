import { updateRoutineOccurrence } from "../../../../../../db/time-repository";
import { parseOccurrenceUpdate } from "../../../../../../lib/time/validation";
import { jsonError, readJson } from "../../../../../../lib/server/http";

interface Context {
  params: Promise<{ id: string; date: string }>;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id, date } = await context.params;
    const input = parseOccurrenceUpdate(await readJson(request));
    const occurrence = await updateRoutineOccurrence(
      id,
      date,
      input.status,
      input.note,
    );
    if (!occurrence) {
      return Response.json({ error: "Routine not found." }, { status: 404 });
    }
    return Response.json({ occurrence });
  } catch (error) {
    return jsonError(error);
  }
}
