import { addDays, localDateInZone } from "./rules";
import type {
  CalendarEvent,
  CalendarPayload,
  RoutineOccurrence,
} from "./types";

const inactiveStatuses = new Set(["completed", "dismissed", "cancelled"]);

function active(event: CalendarEvent) {
  return !inactiveStatuses.has(event.status);
}

export function sortCalendarEvents(events: CalendarEvent[]) {
  return [...events].sort((left, right) => {
    if (left.localDate !== right.localDate) {
      return left.localDate.localeCompare(right.localDate);
    }
    if (left.allDay !== right.allDay) return left.allDay ? -1 : 1;
    if (!left.startAt && !right.startAt)
      return left.title.localeCompare(right.title);
    if (!left.startAt) return -1;
    if (!right.startAt) return 1;
    return Date.parse(left.startAt) - Date.parse(right.startAt);
  });
}

export function eventsForDate(events: CalendarEvent[], date: string) {
  return sortCalendarEvents(
    events.filter(
      (event) => event.localDate <= date && event.endLocalDate >= date,
    ),
  );
}

export function nextCalendarEvent(events: CalendarEvent[], now: Date) {
  return (
    sortCalendarEvents(events)
      .filter(
        (event) =>
          active(event) &&
          !event.allDay &&
          event.startAt &&
          Date.parse(event.startAt) > now.getTime(),
      )
      .at(0) ?? null
  );
}

export function attentionNeeded(events: CalendarEvent[], now: Date) {
  return sortCalendarEvents(
    events.filter(
      (event) =>
        active(event) &&
        !event.allDay &&
        event.startAt &&
        Date.parse(event.endAt ?? event.startAt) < now.getTime(),
    ),
  );
}

function withinDays(date: string, today: string, days: number) {
  return date >= today && date <= addDays(today, days);
}

export function upcomingCalendarRisks(events: CalendarEvent[], today: string) {
  return sortCalendarEvents(
    events.filter(
      (event) =>
        active(event) &&
        ((event.eventType === "birthday" &&
          withinDays(event.localDate, today, 14)) ||
          (event.eventType === "financial" &&
            withinDays(event.localDate, today, 7)) ||
          (event.eventType === "medical" &&
            withinDays(event.localDate, today, 7))),
    ),
  );
}

export interface TodayMissionItem {
  id: string;
  kind: "next" | "priority" | "bill" | "routine" | "birthday";
  label: string;
  detail: string;
  event?: CalendarEvent;
  occurrence?: RoutineOccurrence;
}

export function todayMission(data: CalendarPayload, now: Date) {
  const today = localDateInZone(now, data.preferences.timeZone);
  const next = nextCalendarEvent(eventsForDate(data.events, today), now);
  const priority = data.priorities
    .filter((item) => item.status === "active" && !item.archivedAt)
    .sort(
      (left, right) =>
        Number(right.isTop !== false) - Number(left.isTop !== false) ||
        left.position - right.position,
    )[0];
  const future = upcomingCalendarRisks(data.events, today);
  const bill = future.find((event) => event.eventType === "financial");
  const birthday = future.find((event) => event.eventType === "birthday");
  const routine = data.occurrences
    .filter(
      (item) =>
        item.scheduledDate === today &&
        !["completed", "skipped"].includes(item.status),
    )
    .sort((left, right) =>
      (left.scheduledAt ?? "").localeCompare(right.scheduledAt ?? ""),
    )[0];
  const items: Array<TodayMissionItem | null> = [
    next
      ? {
          id: `next-${next.occurrenceKey}`,
          kind: "next" as const,
          label: "Next event",
          detail: next.title,
          event: next,
        }
      : null,
    priority
      ? {
          id: `priority-${priority.id}`,
          kind: "priority" as const,
          label: "Highest priority",
          detail: priority.title,
        }
      : null,
    bill
      ? {
          id: `bill-${bill.occurrenceKey}`,
          kind: "bill" as const,
          label: "Next bill",
          detail: bill.title,
          event: bill,
        }
      : null,
    routine
      ? {
          id: `routine-${routine.id}`,
          kind: "routine" as const,
          label: "Next routine",
          detail: routine.routineName,
          occurrence: routine,
        }
      : null,
    birthday
      ? {
          id: `birthday-${birthday.occurrenceKey}`,
          kind: "birthday" as const,
          label: "Approaching birthday",
          detail: birthday.title,
          event: birthday,
        }
      : null,
  ];
  return items.filter((item): item is TodayMissionItem => item !== null);
}
