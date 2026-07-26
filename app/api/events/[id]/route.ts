import {
  deleteCalendarEvent,
  findEventConflicts,
  updateCalendarEvent,
} from "../../../../db/time-repository";
import {
  parseCalendarEvent,
  parseDateKey,
  parseRecurrenceScope,
} from "../../../../lib/time/validation";
import { jsonError, readJson } from "../../../../lib/server/http";

interface Context {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = (await readJson(request)) as {
      event?: unknown;
      occurrenceDate?: unknown;
      scope?: unknown;
      acknowledgeConflict?: boolean;
    };
    const input = parseCalendarEvent(body.event);
    const occurrenceDate =
      body.occurrenceDate === undefined
        ? input.localDate
        : parseDateKey(body.occurrenceDate, "Occurrence date");
    const scope = parseRecurrenceScope(body.scope ?? "series");
    const conflicts = await findEventConflicts(input, id);
    if (conflicts.length && !body.acknowledgeConflict) {
      return Response.json(
        {
          error: "This change overlaps another commitment.",
          conflicts: conflicts.map((event) => ({
            id: event.id,
            title: event.title,
            startAt: event.startAt,
            endAt: event.endAt,
          })),
        },
        { status: 409 },
      );
    }
    const event = await updateCalendarEvent(id, occurrenceDate, scope, input);
    if (!event) {
      return Response.json({ error: "Event not found." }, { status: 404 });
    }
    return Response.json({ event, conflicts });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = (await readJson(request)) as {
      occurrenceDate?: unknown;
      scope?: unknown;
    };
    const occurrenceDate = parseDateKey(body.occurrenceDate, "Occurrence date");
    const result = await deleteCalendarEvent(
      id,
      occurrenceDate,
      parseRecurrenceScope(body.scope ?? "series"),
    );
    if (!result) {
      return Response.json({ error: "Event not found." }, { status: 404 });
    }
    return Response.json({ result });
  } catch (error) {
    return jsonError(error);
  }
}
