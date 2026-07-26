import {
  getCalendarProposal,
  getCalendarSource,
  recordCalendarAudit,
  saveCalendarProposal,
} from "../../../../../db/calendar-intelligence-repository";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  findEventConflicts,
  getCalendarEventOccurrence,
  updateCalendarEvent,
} from "../../../../../db/time-repository";
import type {
  CalendarOperation,
  ProposalResult,
} from "../../../../../lib/calendar-intelligence/types";
import type { CalendarEvent } from "../../../../../lib/time/types";
import { parseCalendarEvent } from "../../../../../lib/time/validation";
import { ValidationError } from "../../../../../lib/domain/validation";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
} from "../../../../../lib/server/google-calendar";
import { jsonError, readJson } from "../../../../../lib/server/http";

interface Context {
  params: Promise<{ id: string }>;
}

async function validateOperation(operation: CalendarOperation) {
  if (operation.type === "create-event") {
    const event = parseCalendarEvent(operation.event);
    const conflicts = await findEventConflicts(event);
    return { event, conflicts };
  }
  const event = parseCalendarEvent(operation.after);
  const conflicts = await findEventConflicts(event, operation.eventId);
  return { event, conflicts };
}

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = (await readJson(request)) as {
      approvedOperationIds?: unknown;
      acknowledgeConflicts?: unknown;
    };
    const proposal = await getCalendarProposal(id);
    if (!proposal) {
      return Response.json({ error: "Proposal not found." }, { status: 404 });
    }
    if (proposal.status !== "draft" && proposal.status !== "approved") {
      throw new ValidationError("This proposal is no longer available to apply.");
    }
    if (Date.parse(proposal.expiresAt) <= Date.now()) {
      throw new ValidationError(
        "This proposal expired. Rebuild it against the current Calendar.",
      );
    }
    const approvedIds = Array.isArray(body.approvedOperationIds)
      ? new Set(
          body.approvedOperationIds.filter(
            (value): value is string => typeof value === "string",
          ),
        )
      : new Set(proposal.operations.map((operation) => operation.id));
    const operations = proposal.operations.filter((operation) =>
      approvedIds.has(operation.id),
    );
    const validated = await Promise.all(operations.map(validateOperation));
    const conflicts = validated.flatMap((item) => item.conflicts);
    if (conflicts.length && body.acknowledgeConflicts !== true) {
      return Response.json(
        {
          error: "The Calendar changed and this proposal now conflicts.",
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

    proposal.status = "applying";
    await saveCalendarProposal(proposal);
    const events: CalendarEvent[] = [];
    const applied: CalendarOperation[] = [];
    const before = operations.flatMap((operation) =>
      operation.type === "move-event" ? [operation.before] : [],
    );
    const after = operations.map((operation) =>
      operation.type === "move-event" ? operation.after : operation.event,
    );
    try {
      for (let index = 0; index < operations.length; index += 1) {
        const operation = operations[index];
        const event = validated[index].event;
        if (operation.type === "create-event") {
          const destination = await getCalendarSource(
            operation.destinationSourceId ?? "nexus",
          );
          if (!destination || destination.access !== "write") {
            throw new Error("The destination calendar is no longer writable.");
          }
          if (destination.provider === "google") {
            const created = await createGoogleCalendarEvent(
              destination.id,
              event,
            );
            const materialized = await getCalendarEventOccurrence(
              created.localId,
              event.localDate,
            );
            if (materialized) events.push(materialized);
          } else {
            const created = await createCalendarEvent(
              event,
              `${proposal.id}:${operation.id}`,
            );
            if (created) events.push(created);
          }
        } else {
          const updated = await updateCalendarEvent(
            operation.eventId,
            operation.occurrenceDate,
            "occurrence",
            event,
          );
          if (!updated) throw new Error("A proposed event no longer exists.");
          events.push(updated);
        }
        applied.push(operation);
      }
    } catch (error) {
      for (const operation of applied.reverse()) {
        try {
          if (operation.type === "create-event") {
            const destination = await getCalendarSource(
              operation.destinationSourceId ?? "nexus",
            );
            const createdId = `${proposal.id}:${operation.id}`;
            if (destination?.provider === "google") {
              const created = events.find(
                (event) => event.localDate === operation.event.localDate,
              );
              if (created) {
                await deleteGoogleCalendarEvent(created.id);
                await deleteCalendarEvent(
                  created.id,
                  created.occurrenceDate,
                  "series",
                );
              }
            } else {
              await deleteCalendarEvent(
                createdId,
                operation.event.localDate,
                "series",
              );
            }
          } else {
            await updateCalendarEvent(
              operation.eventId,
              operation.occurrenceDate,
              "occurrence",
              operation.before,
            );
          }
        } catch {
          // The response below reports that recovery requires review.
        }
      }
      proposal.status = "partially-applied";
      await saveCalendarProposal(proposal);
      throw error;
    }

    proposal.status = "applied";
    await saveCalendarProposal(proposal);
    const eventIds = events.map((event) => event.id);
    const auditId = await recordCalendarAudit({
      actor: "atlas",
      action: operations.some((operation) => operation.type === "move-event")
        ? "proposal-move"
        : "proposal-create",
      source: "calendar-proposal",
      eventIds,
      summary: `Applied ${operations.length} reviewed Calendar change${
        operations.length === 1 ? "" : "s"
      }.`,
      providerResult: operations.some(
        (operation) =>
          operation.type === "create-event" &&
          operation.destinationSourceId !== "nexus",
      )
        ? "confirmed"
        : null,
      proposalId: proposal.id,
      undoAvailable: operations.length > 0,
      before,
      after,
    });
    const result: ProposalResult = {
      proposal,
      events,
      auditId,
      undoUntil: operations.length
        ? new Date(Date.now() + 10 * 60_000).toISOString()
        : null,
    };
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = (await readJson(request)) as {
      action?: unknown;
      operationId?: unknown;
      event?: unknown;
      destinationSourceId?: unknown;
    };
    if (body.action !== "reject" && body.action !== "edit") {
      throw new ValidationError("Proposal action is invalid.");
    }
    const proposal = await getCalendarProposal(id);
    if (!proposal) {
      return Response.json({ error: "Proposal not found." }, { status: 404 });
    }
    if (body.action === "reject") {
      proposal.status = "rejected";
    } else {
      if (typeof body.operationId !== "string") {
        throw new ValidationError("Proposal operation is required.");
      }
      const operation = proposal.operations.find(
        (item) => item.id === body.operationId,
      );
      if (!operation) {
        throw new ValidationError("Proposal operation was not found.");
      }
      const event = parseCalendarEvent(body.event);
      if (operation.type === "create-event") {
        operation.event = event;
        if (typeof body.destinationSourceId === "string") {
          const source = await getCalendarSource(body.destinationSourceId);
          if (!source || source.access !== "write") {
            throw new ValidationError(
              "Choose a writable destination calendar.",
            );
          }
          operation.destinationSourceId = source.id;
        }
      } else {
        operation.after = event;
      }
      proposal.summary = `Reviewed ${event.title} for ${event.localDate}.`;
    }
    await saveCalendarProposal(proposal);
    return Response.json({ proposal });
  } catch (error) {
    return jsonError(error);
  }
}
