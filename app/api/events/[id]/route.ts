import {
  deleteCalendarEvent,
  findEventConflicts,
  updateCalendarEvent,
} from "../../../../db/time-repository";
import {
  parseCalendarEvent,
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
      typeof body.occurrenceDate === "string"
        ? body.occurrenceDate
        : input.localDate;
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
    if (typeof body.occurrenceDate !== "string") {
      return Response.json(
        { error: "Occurrence date is required." },
        { status: 400 },
      );
    }
    const result = await deleteCalendarEvent(
      id,
      body.occurrenceDate,
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
