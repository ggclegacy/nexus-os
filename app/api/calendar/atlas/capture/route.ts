import {
  listCalendarSources,
  saveCalendarProposal,
} from "../../../../../db/calendar-intelligence-repository";
import {
  findEventConflicts,
  getTimePreferences,
} from "../../../../../db/time-repository";
import type { CalendarProposal } from "../../../../../lib/calendar-intelligence/types";
import { ValidationError } from "../../../../../lib/domain/validation";
import { atlasCapture } from "../../../../../lib/server/atlas-calendar";
import { jsonError, readJson, requestId } from "../../../../../lib/server/http";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as {
      request?: unknown;
      destinationSourceId?: unknown;
    };
    if (
      typeof body.request !== "string" ||
      !body.request.trim() ||
      body.request.length > 1_000
    ) {
      throw new ValidationError(
        "Describe the calendar item in 1,000 characters or fewer.",
      );
    }
    const [preferences, sources] = await Promise.all([
      getTimePreferences(),
      listCalendarSources(),
    ]);
    const parsed = await atlasCapture(body.request.trim(), preferences);
    const destinationSourceId =
      typeof body.destinationSourceId === "string"
        ? body.destinationSourceId
        : (sources.find(
            (source) => source.isDefault && source.access === "write",
          )?.id ?? "nexus");
    const destination = sources.find(
      (source) => source.id === destinationSourceId,
    );
    if (!destination || destination.access !== "write") {
      throw new ValidationError("Choose a writable destination calendar.");
    }
    const conflicts = await findEventConflicts(parsed.event);
    const id = requestId(request);
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    const preview = {
      ...parsed,
      id,
      destinationSourceId,
      conflicts: conflicts.map((event) => ({
        id: event.id,
        title: event.title,
        startAt: event.startAt,
        endAt: event.endAt,
      })),
      expiresAt,
    };
    const proposal: CalendarProposal = {
      id,
      userRequest: body.request.trim(),
      summary: parsed.summary,
      operations: [
        {
          id: `${id}:create`,
          type: "create-event",
          event: parsed.event,
          destinationSourceId,
          reason: "Structured from the reviewed capture request.",
        },
      ],
      assumptions: [...parsed.assumptions, ...parsed.ambiguities],
      conflicts: preview.conflicts,
      status: "draft",
      expiresAt,
      createdAt,
    };
    await saveCalendarProposal(proposal);
    return Response.json({ preview, proposal });
  } catch (error) {
    return jsonError(error);
  }
}
