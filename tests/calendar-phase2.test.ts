import { describe, expect, it } from "vitest";
import {
  agendaSection,
  billPlanning,
  birthdayPlanning,
  calendarBrief,
  monthGrid,
  reminderBuckets,
  rescueCandidates,
  scheduleWarnings,
  snoozeTime,
} from "../lib/time/phase-two";
import { expandRecurrence } from "../lib/time/rules";
import type {
  CalendarEvent,
  CalendarPayload,
  ReminderInstance,
} from "../lib/time/types";
import { FakeTimeApi } from "./fixtures";

const now = new Date("2026-07-26T17:00:00.000Z");

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "event-1",
    occurrenceKey: "event-1:2026-07-26",
    occurrenceDate: "2026-07-26",
    seriesId: null,
    title: "Calendar item",
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
    startTime: "10:00",
    endTime: "11:00",
    startAt: "2026-07-26T15:00:00.000Z",
    endAt: "2026-07-26T16:00:00.000Z",
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

function reminder(overrides: Partial<ReminderInstance> = {}): ReminderInstance {
  return {
    id: "reminder-1",
    reminderId: "rule-1",
    occurrenceKey: "event-1:2026-07-26",
    eventId: "event-1",
    occurrenceDate: "2026-07-26",
    state: "delivered",
    scheduledFor: "2026-07-26T14:00:00.000Z",
    deliveredAt: "2026-07-26T14:00:00.000Z",
    seenAt: null,
    snoozedUntil: null,
    resolvedAt: null,
    escalationLevel: 0,
    nextEscalationAt: null,
    reason: "Event begins soon",
    ruleLabel: "1 hour before",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

function payload(events: CalendarEvent[]): CalendarPayload {
  const api = new FakeTimeApi();
  return {
    rangeStart: "2026-07-26",
    rangeEnd: "2026-08-31",
    events,
    priorities: [],
    routines: [],
    occurrences: [],
    reminders: [],
    reminderInstances: [],
    preferences: api.preferences,
    sourceLabel: "Private local workspace",
    lastUpdatedAt: now.toISOString(),
    stale: false,
    syncAvailable: false,
  };
}

describe("Calendar Phase 2 domain behavior", () => {
  it("uses a stable six-week month grid and deterministic agenda sections", () => {
    const grid = monthGrid("2026-02-12", 1);
    expect(grid.dates).toHaveLength(42);
    expect(grid.gridStart).toBe("2026-01-26");
    expect(agendaSection("2026-07-26", "2026-07-26")).toBe("Today");
    expect(agendaSection("2026-07-27", "2026-07-26")).toBe("Tomorrow");
    expect(agendaSection("2026-08-10", "2026-07-26")).toBe("Later");
  });

  it("supports relative, last-day, and leap-day recurrence rules", () => {
    expect(
      expandRecurrence("2026-01-27", "2026-02-01", "2026-04-30", {
        frequency: "monthly",
        interval: 1,
        weekdays: [],
        monthlyMode: "relative",
        monthlyWeekday: 2,
        monthlyOrdinal: -1,
        until: null,
        count: null,
      }),
    ).toEqual(["2026-02-24", "2026-03-31", "2026-04-28"]);
    expect(
      expandRecurrence("2026-01-31", "2026-02-01", "2026-04-30", {
        frequency: "monthly",
        interval: 1,
        weekdays: [],
        monthlyMode: "last-day",
        until: null,
        count: null,
      }),
    ).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(
      expandRecurrence("2024-02-29", "2025-01-01", "2028-12-31", {
        frequency: "yearly",
        interval: 1,
        weekdays: [],
        monthlyMode: "date",
        until: null,
        count: null,
      }),
    ).toEqual(["2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"]);
  });

  it("detects overlaps and transition pressure without changing events", () => {
    const first = event({ title: "First", endAt: "2026-07-26T16:30:00.000Z" });
    const overlap = event({
      id: "overlap",
      occurrenceKey: "overlap",
      title: "Overlap",
      startAt: "2026-07-26T16:15:00.000Z",
      endAt: "2026-07-26T17:00:00.000Z",
    });
    const tight = event({
      id: "tight",
      occurrenceKey: "tight",
      title: "Tight",
      startAt: "2026-07-26T17:10:00.000Z",
      endAt: "2026-07-26T18:00:00.000Z",
    });
    expect(
      scheduleWarnings([first, overlap, tight], 15).map((item) => item.kind),
    ).toEqual(["conflict", "tight-transition"]);
  });

  it("groups birthday and bill planning without implying payment processing", () => {
    const birthday = event({
      id: "birthday",
      occurrenceKey: "birthday",
      eventType: "birthday",
      allDay: true,
      localDate: "2026-08-01",
      endLocalDate: "2026-08-01",
      startAt: null,
      endAt: null,
      birthYear: 1990,
    });
    const bill = event({
      id: "bill",
      occurrenceKey: "bill",
      eventType: "financial",
      localDate: "2026-07-28",
      endLocalDate: "2026-07-28",
      amount: 125,
      paymentStatus: "unpaid",
    });
    expect(birthdayPlanning([birthday], "2026-07-26")[0]).toMatchObject({
      age: 36,
      horizon: "Next 14 days",
    });
    expect(billPlanning([bill], "2026-07-26", "en-US")).toMatchObject({
      dueSoon: [bill],
      totals: [{ currency: "USD", amount: 125, formatted: "$125.00" }],
    });
  });

  it("keeps reminder lifecycle states mutually visible and snooze deterministic", () => {
    const item = event();
    const buckets = reminderBuckets(
      [
        reminder(),
        reminder({ id: "snoozed", state: "snoozed" }),
        reminder({
          id: "future",
          state: "scheduled",
          scheduledFor: "2026-07-27T14:00:00.000Z",
        }),
        reminder({ id: "resolved", state: "resolved" }),
      ],
      [item],
      now,
    );
    expect(buckets.needsAction).toHaveLength(1);
    expect(buckets.snoozed).toHaveLength(1);
    expect(buckets.upcoming).toHaveLength(1);
    expect(buckets.resolved).toHaveLength(1);
    expect(snoozeTime("15m", now, "America/Chicago")).toBe(
      "2026-07-26T17:15:00.000Z",
    );
  });

  it("builds briefs and rescue candidates only from unresolved actionable records", () => {
    const overdue = event({
      eventType: "financial",
      paymentStatus: "unpaid",
      endAt: "2026-07-26T16:00:00.000Z",
    });
    const birthday = event({
      id: "birthday",
      occurrenceKey: "birthday",
      eventType: "birthday",
      allDay: true,
      localDate: "2026-08-01",
      endLocalDate: "2026-08-01",
      startAt: null,
      endAt: null,
    });
    expect(rescueCandidates([overdue, birthday], now)).toEqual([overdue]);
    const brief = calendarBrief(payload([overdue, birthday]), now, "morning");
    expect(brief.title).toBe("Morning Brief");
    expect(brief.bills).toEqual([overdue]);
    expect(brief.birthdays).toEqual([birthday]);
    expect(brief.unresolved).toEqual([overdue]);
  });
});
