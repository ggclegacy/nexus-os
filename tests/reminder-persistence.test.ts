import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { CalendarFilters } from "../lib/time/types";
import { parseCalendarEvent } from "../lib/time/validation";

const filters: CalendarFilters = {
  query: "",
  includeEvents: true,
  includePriorities: true,
  includeRoutines: true,
  includeCompleted: false,
  eventTypes: [],
  statuses: [],
  priorities: [],
  payment: "all",
  recurrence: "all",
};

describe("persistent reminder lifecycle", () => {
  let repository: typeof import("../db/time-repository");
  let date: string;

  beforeAll(async () => {
    const databasePath = join(
      tmpdir(),
      `nexus-calendar-phase2-${randomUUID()}.db`,
    );
    process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
    repository = await import("../db/time-repository");
    const future = new Date(Date.now() + 2 * 60 * 60_000);
    date = future.toISOString().slice(0, 10);
    const startTime = future.toISOString().slice(11, 16);
    const end = new Date(future.getTime() + 30 * 60_000);
    await repository.createCalendarEvent(
      parseCalendarEvent({
        title: "Reminder persistence check",
        eventType: "reminder",
        localDate: date,
        endLocalDate: end.toISOString().slice(0, 10),
        startTime,
        endTime: end.toISOString().slice(11, 16),
        timeZone: "UTC",
        reminderOffsets: [60],
      }),
    );
  });

  it("reconciles once, snoozes, and resolves without creating duplicates", async () => {
    const first = await repository.listCalendarPayload(date, date, filters);
    expect(first.reminderInstances).toHaveLength(1);
    const reminder = first.reminderInstances[0];
    expect(reminder.state).toBe("scheduled");

    const snoozedUntil = new Date(Date.now() + 3 * 60 * 60_000).toISOString();
    await repository.updateReminderInstance(
      reminder.id,
      "snooze",
      snoozedUntil,
    );
    const second = await repository.listCalendarPayload(date, date, filters);
    expect(second.reminderInstances).toHaveLength(1);
    expect(second.reminderInstances[0]).toMatchObject({
      id: reminder.id,
      state: "snoozed",
      snoozedUntil,
    });

    await repository.updateReminderInstance(reminder.id, "resolve");
    const third = await repository.listCalendarPayload(date, date, filters);
    expect(third.reminderInstances).toHaveLength(1);
    expect(third.reminderInstances[0].state).toBe("resolved");
  });
});
