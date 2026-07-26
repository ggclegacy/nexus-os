import { describe, expect, it } from "vitest";
import {
  attentionNeeded,
  eventsForDate,
  nextCalendarEvent,
  sortCalendarEvents,
  upcomingCalendarRisks,
} from "../lib/time/calendar-selectors";
import {
  CALENDAR_EVENT_TYPES,
  eventTypeDefaults,
} from "../lib/time/event-types";
import type { CalendarEvent } from "../lib/time/types";
import { parseCalendarEvent } from "../lib/time/validation";

const now = new Date("2026-07-26T15:00:00.000Z");

function calendarEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "event-1",
    occurrenceKey: "event-1",
    occurrenceDate: "2026-07-26",
    seriesId: null,
    title: "Personal appointment",
    eventType: "personal",
    notes: "",
    location: "",
    provider: "",
    meetingUrl: "",
    amount: null,
    currency: "USD",
    paymentStatus: null,
    priority: "standard",
    status: "scheduled",
    allDay: false,
    localDate: "2026-07-26",
    endLocalDate: "2026-07-26",
    startTime: "11:00",
    endTime: "12:00",
    startAt: "2026-07-26T16:00:00.000Z",
    endAt: "2026-07-26T17:00:00.000Z",
    timeZone: "America/Chicago",
    recurrence: null,
    reminderOffsets: [],
    source: "local",
    sourceId: null,
    externalCalendarId: null,
    lastSyncedAt: null,
    localVersion: 1,
    remoteVersion: null,
    readOnly: false,
    conflictState: "none",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

describe("Calendar Phase 1 selectors", () => {
  it("sorts all-day items first and timed items chronologically", () => {
    const events = [
      calendarEvent({
        id: "late",
        occurrenceKey: "late",
        startAt: "2026-07-26T20:00:00.000Z",
      }),
      calendarEvent({
        id: "all-day",
        occurrenceKey: "all-day",
        allDay: true,
        startAt: null,
        endAt: null,
      }),
      calendarEvent({
        id: "early",
        occurrenceKey: "early",
        startAt: "2026-07-26T16:00:00.000Z",
      }),
    ];
    expect(sortCalendarEvents(events).map((event) => event.id)).toEqual([
      "all-day",
      "early",
      "late",
    ]);
    expect(eventsForDate(events, "2026-07-26")).toHaveLength(3);
  });

  it("derives the next event and keeps unresolved past events in attention", () => {
    const past = calendarEvent({
      id: "past",
      occurrenceKey: "past",
      startAt: "2026-07-26T14:00:00.000Z",
      endAt: "2026-07-26T14:30:00.000Z",
    });
    const future = calendarEvent({
      id: "future",
      occurrenceKey: "future",
      startAt: "2026-07-26T16:00:00.000Z",
    });
    const completed = calendarEvent({
      id: "completed",
      occurrenceKey: "completed",
      status: "completed",
      startAt: "2026-07-26T13:00:00.000Z",
    });
    const inProgress = calendarEvent({
      id: "in-progress",
      occurrenceKey: "in-progress",
      startAt: "2026-07-26T14:30:00.000Z",
      endAt: "2026-07-26T15:30:00.000Z",
    });
    expect(
      nextCalendarEvent([past, future, completed, inProgress], now)?.id,
    ).toBe("future");
    expect(
      attentionNeeded([past, future, completed, inProgress], now).map(
        (event) => event.id,
      ),
    ).toEqual(["past"]);
  });

  it("uses the required type defaults without a rainbow category model", () => {
    expect(eventTypeDefaults("birthday")).toMatchObject({
      allDay: true,
      reminderOffsets: [0, 4_320, 20_160],
      recurrence: { frequency: "yearly" },
    });
    expect(eventTypeDefaults("financial").reminderOffsets).toEqual([
      0, 1_440, 4_320, 10_080,
    ]);
    expect(eventTypeDefaults("medical").reminderOffsets).toEqual([
      120, 1_440, 4_320, 10_080,
    ]);
    expect(eventTypeDefaults("meeting").reminderOffsets).toEqual([
      15, 60, 1_440,
    ]);
    expect(eventTypeDefaults("workout").reminderOffsets).toEqual([30]);
    expect(eventTypeDefaults("protocol").reminderOffsets).toEqual([30]);
    expect(Object.keys(CALENDAR_EVENT_TYPES)).toHaveLength(11);
  });

  it("applies type defaults during validation and rejects unsafe metadata", () => {
    expect(
      parseCalendarEvent({
        title: "Annual birthday",
        eventType: "birthday",
        localDate: "2026-08-09",
        timeZone: "America/Chicago",
      }),
    ).toMatchObject({
      allDay: true,
      paymentStatus: null,
      reminderOffsets: [0, 4_320, 20_160],
      recurrence: { frequency: "yearly" },
    });
    expect(() =>
      parseCalendarEvent({
        title: "Unknown type",
        eventType: "rainbow",
        localDate: "2026-08-09",
        timeZone: "America/Chicago",
      }),
    ).toThrow("Event type is invalid");
    expect(() =>
      parseCalendarEvent({
        title: "Unsafe meeting",
        eventType: "meeting",
        localDate: "2026-08-09",
        startTime: "10:00",
        endTime: "11:00",
        timeZone: "America/Chicago",
        meetingUrl: "javascript:alert(1)",
      }),
    ).toThrow("Meeting link must be a valid web address");
  });

  it("uses separate birthday and bill look-ahead windows", () => {
    const bill = calendarEvent({
      id: "bill",
      occurrenceKey: "bill",
      eventType: "financial",
      localDate: "2026-08-02",
      endLocalDate: "2026-08-02",
    });
    const birthday = calendarEvent({
      id: "birthday",
      occurrenceKey: "birthday",
      eventType: "birthday",
      localDate: "2026-08-09",
      endLocalDate: "2026-08-09",
      allDay: true,
      startAt: null,
      endAt: null,
    });
    const lateBill = calendarEvent({
      id: "late-bill",
      occurrenceKey: "late-bill",
      eventType: "financial",
      localDate: "2026-08-03",
      endLocalDate: "2026-08-03",
    });
    expect(
      upcomingCalendarRisks([bill, birthday, lateBill], "2026-07-26").map(
        (event) => event.id,
      ),
    ).toEqual(["bill", "birthday"]);
  });
});
