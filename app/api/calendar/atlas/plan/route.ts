import { saveCalendarProposal } from "../../../../../db/calendar-intelligence-repository";
import {
  getTimePreferences,
  listCalendarEvents,
} from "../../../../../db/time-repository";
import {
  calendarEventInput,
  findAvailability,
} from "../../../../../lib/calendar-intelligence/deterministic";
import type { CalendarProposal } from "../../../../../lib/calendar-intelligence/types";
import { addDays } from "../../../../../lib/time/rules";
import { parseDateKey } from "../../../../../lib/time/validation";
import { jsonError, readJson, requestId } from "../../../../../lib/server/http";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as { date?: unknown };
    const date = parseDateKey(body.date, "Plan date");
    const [preferences, events] = await Promise.all([
      getTimePreferences(),
      listCalendarEvents(addDays(date, -14), date),
    ]);
    const movable = events
      .filter(
        (event) =>
          event.source === "local" &&
          event.status === "scheduled" &&
          event.localDate < date &&
          ["personal", "workout", "reminder"].includes(event.eventType),
      )
      .slice(0, 3);
    const fixed = events.filter(
      (event) => event.localDate === date && event.status === "scheduled",
    );
    const slots = findAvailability(fixed, preferences, {
      durationMinutes: preferences.defaultEventDurationMinutes,
      startDate: date,
      endDate: date,
      preferredPeriod: "any",
    });
    const id = requestId(request);
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    const operations = movable
      .slice(0, slots.length)
      .map((event, index) => {
        const before = calendarEventInput(event);
        const slot = slots[index];
        return {
          id: `${id}:move:${index}`,
          type: "move-event" as const,
          eventId: event.id,
          occurrenceDate: event.occurrenceDate,
          before,
          after: {
            ...before,
            allDay: false,
            localDate: slot.localDate,
            endLocalDate: slot.localDate,
            startTime: slot.startTime,
            endTime: slot.endTime,
          },
          reason: `This unresolved flexible item fits an open block with the ${preferences.transitionBufferMinutes}-minute buffer preserved.`,
        };
      });
    const proposal: CalendarProposal = {
      id,
      userRequest: `Plan ${date}`,
      summary: operations.length
        ? `Place ${operations.length} unresolved flexible item${
            operations.length === 1 ? "" : "s"
          } into open time on ${date}.`
        : `No unresolved flexible items need placement on ${date}.`,
      operations,
      assumptions: [
        "Only overdue local personal, workout, and reminder events are movable.",
        "Meetings, medical events, bills, birthdays, and external events stay fixed.",
      ],
      conflicts: [],
      status: "draft",
      expiresAt,
      createdAt,
    };
    await saveCalendarProposal(proposal);
    return Response.json({ proposal });
  } catch (error) {
    return jsonError(error);
  }
}
