import {
  deleteTimelineItem,
  updateTimelineItem,
} from "../../../../db/command-repository";
import { updateRoutineOccurrence } from "../../../../db/time-repository";
import { parseTimelineUpdate } from "../../../../lib/domain/validation";
import { jsonError, readJson } from "../../../../lib/server/http";

interface Context {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const update = parseTimelineUpdate(await readJson(request));
    if (id.startsWith("routine:")) {
      const [, routineId, scheduledDate] = id.split(":");
      const status =
        update.status === "completed"
          ? "completed"
          : update.status === "skipped"
            ? "skipped"
            : "due";
      const occurrence = await updateRoutineOccurrence(
        routineId,
        scheduledDate,
        status,
        "",
      );
      if (!occurrence) {
        return Response.json(
          { error: "Routine occurrence not found." },
          { status: 404 },
        );
      }
      return Response.json({
        item: {
          id,
          title: occurrence.routineName,
          kind: "routine",
          status:
            occurrence.status === "completed"
              ? "completed"
              : occurrence.status === "skipped"
                ? "skipped"
                : "scheduled",
          startAt: occurrence.scheduledAt,
          endAt: occurrence.windowEndAt,
          localDate: occurrence.scheduledDate,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          notes: occurrence.note,
          source: "local",
          createdAt: occurrence.updatedAt,
          updatedAt: occurrence.updatedAt,
          routineId,
          occurrenceDate: scheduledDate,
        },
      });
    }
    if (id.startsWith("event:")) {
      return Response.json(
        {
          error:
            "Open Calendar to choose whether this recurring change affects one event, future events, or the entire series.",
        },
        { status: 409 },
      );
    }
    const item = await updateTimelineItem(id, update);
    if (!item) {
      return Response.json(
        { error: "Timeline item not found." },
        { status: 404 },
      );
    }
    return Response.json({ item });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (id.startsWith("routine:") || id.startsWith("event:")) {
      return Response.json(
        {
          error:
            "Open Calendar to review the consequence of removing this recurring item.",
        },
        { status: 409 },
      );
    }
    const item = await deleteTimelineItem(id);
    if (!item) {
      return Response.json(
        { error: "Timeline item not found." },
        { status: 404 },
      );
    }
    return Response.json({ item });
  } catch (error) {
    return jsonError(error);
  }
}
