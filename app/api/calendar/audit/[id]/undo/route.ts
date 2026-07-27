import {
  getCalendarAuditDetail,
  markCalendarAuditUndone,
  recordCalendarAudit,
} from "../../../../../../db/calendar-intelligence-repository";
import {
  deleteCalendarEvent,
  updateCalendarEvent,
} from "../../../../../../db/time-repository";
import { deleteGoogleCalendarEvent } from "../../../../../../lib/server/google-calendar";
import { jsonError } from "../../../../../../lib/server/http";
import { ValidationError } from "../../../../../../lib/domain/validation";

interface Context {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const detail = await getCalendarAuditDetail(id);
    if (!detail || !detail.entry.undoAvailable) {
      throw new ValidationError("This Calendar change cannot be undone.");
    }
    if (Date.parse(detail.entry.createdAt) < Date.now() - 10 * 60_000) {
      throw new ValidationError("The undo window has ended.");
    }
    if (detail.entry.action === "proposal-create") {
      for (let index = 0; index < detail.entry.eventIds.length; index += 1) {
        const eventId = detail.entry.eventIds[index];
        const input = detail.after[index];
        await deleteGoogleCalendarEvent(eventId);
        await deleteCalendarEvent(eventId, input.localDate, "series");
      }
    } else if (detail.entry.action === "proposal-move") {
      for (let index = 0; index < detail.entry.eventIds.length; index += 1) {
        const eventId = detail.entry.eventIds[index];
        const input = detail.before[index];
        await updateCalendarEvent(
          eventId,
          input.localDate,
          "occurrence",
          input,
        );
      }
    } else {
      throw new ValidationError("This audit action does not support undo.");
    }
    await markCalendarAuditUndone(id);
    await recordCalendarAudit({
      actor: "owner",
      action: "undo",
      source: "calendar-audit",
      eventIds: detail.entry.eventIds,
      summary: "Restored the prior Calendar state.",
      proposalId: detail.entry.proposalId,
    });
    return Response.json({ undone: true });
  } catch (error) {
    return jsonError(error);
  }
}
