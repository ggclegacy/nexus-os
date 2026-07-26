import {
  createCalendarEvent,
  findEventConflicts,
} from "../../../db/time-repository";
import { parseCalendarEvent } from "../../../lib/time/validation";
import { jsonError, readJson } from "../../../lib/server/http";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as {
      event?: unknown;
      acknowledgeConflict?: boolean;
    };
    const input = parseCalendarEvent(body.event ?? body);
    const conflicts = await findEventConflicts(input);
    if (conflicts.length && !body.acknowledgeConflict) {
      return Response.json(
        {
          error: "This event overlaps another commitment.",
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
    return Response.json(
      { event: await createCalendarEvent(input), conflicts },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error);
  }
}
