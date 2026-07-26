import { describe, expect, it } from "vitest";
import {
  expandRecurrence,
  isInQuietHours,
  localDateInZone,
  localTimeInZone,
  routineOccurrenceStatus,
  zonedDateTimeToUtc,
} from "../lib/time/rules";
import { parseCalendarEvent } from "../lib/time/validation";
import type { RecurrenceRule } from "../lib/time/types";

function rule(overrides: Partial<RecurrenceRule> = {}): RecurrenceRule {
  return {
    frequency: "daily",
    interval: 1,
    weekdays: [],
    monthlyMode: "date",
    until: null,
    count: null,
    ...overrides,
  };
}

describe("personal time recurrence", () => {
  it("honors interval, count, and year boundaries", () => {
    expect(
      expandRecurrence(
        "2026-12-30",
        "2026-12-30",
        "2027-01-10",
        rule({ interval: 2, count: 4 }),
      ),
    ).toEqual(["2026-12-30", "2027-01-01", "2027-01-03", "2027-01-05"]);
  });

  it("keeps expansion bounded for dense or long histories", () => {
    expect(
      expandRecurrence("2020-01-01", "2020-01-01", "2029-12-31", rule(), 120),
    ).toHaveLength(120);
    expect(
      expandRecurrence(
        "2000-01-01",
        "2026-07-01",
        "2026-07-31",
        rule({ frequency: "weekly", weekdays: [6] }),
      ),
    ).toHaveLength(4);
    expect(
      expandRecurrence(
        "2020-01-01",
        "2026-07-01",
        "2026-07-31",
        rule({ until: "2020-12-31" }),
      ),
    ).toEqual([]);
  });

  it("skips missing monthly dates instead of inventing a date", () => {
    expect(
      expandRecurrence(
        "2026-01-31",
        "2026-01-01",
        "2026-04-30",
        rule({ frequency: "monthly" }),
      ),
    ).toEqual(["2026-01-31", "2026-03-31"]);
  });

  it("supports relative monthly weekdays and leap-day birthday fallback", () => {
    expect(
      expandRecurrence(
        "2026-01-30",
        "2026-01-01",
        "2026-04-30",
        rule({ frequency: "monthly", monthlyMode: "relative" }),
      ),
    ).toEqual(["2026-01-30", "2026-02-27", "2026-03-27", "2026-04-24"]);
    expect(
      expandRecurrence(
        "2024-02-29",
        "2024-01-01",
        "2028-12-31",
        rule({ frequency: "yearly" }),
      ),
    ).toEqual([
      "2024-02-29",
      "2025-02-28",
      "2026-02-28",
      "2027-02-28",
      "2028-02-29",
    ]);
  });
});

describe("time-zone and boundary behavior", () => {
  it("rejects a daylight-saving gap and round-trips a fall-back time", () => {
    expect(() =>
      zonedDateTimeToUtc("2026-03-08", "02:30", "America/Chicago"),
    ).toThrow("does not exist");

    const fallBack = zonedDateTimeToUtc(
      "2026-11-01",
      "01:30",
      "America/Chicago",
    );
    expect(localDateInZone(fallBack, "America/Chicago")).toBe("2026-11-01");
    expect(localTimeInZone(fallBack, "America/Chicago")).toBe("01:30");
  });

  it("displays the same instant on the correct local date across zones", () => {
    const instant = "2026-07-26T23:30:00.000Z";
    expect(localDateInZone(instant, "America/Chicago")).toBe("2026-07-26");
    expect(localDateInZone(instant, "Pacific/Auckland")).toBe("2026-07-27");
  });

  it("keeps all-day dates fixed and accepts a timed overnight event", () => {
    const allDay = parseCalendarEvent({
      title: "Personal reset",
      allDay: true,
      localDate: "2026-07-26",
      endLocalDate: "2026-07-27",
      timeZone: "Pacific/Auckland",
    });
    expect(allDay.startTime).toBeNull();
    expect(allDay.localDate).toBe("2026-07-26");

    const overnight = parseCalendarEvent({
      title: "Night train",
      allDay: false,
      localDate: "2026-07-26",
      endLocalDate: "2026-07-27",
      startTime: "23:30",
      endTime: "01:00",
      timeZone: "Europe/London",
    });
    expect(overnight.endLocalDate).toBe("2026-07-27");
  });

  it("handles overnight quiet hours and derived routine states", () => {
    const quiet = {
      quietHoursEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
    };
    expect(isInQuietHours("23:00", quiet)).toBe(true);
    expect(isInQuietHours("06:59", quiet)).toBe(true);
    expect(isInQuietHours("12:00", quiet)).toBe(false);

    const now = new Date("2026-07-26T18:00:00.000Z");
    expect(
      routineOccurrenceStatus("2026-07-25", null, null, "America/Chicago", now),
    ).toBe("missed");
    expect(
      routineOccurrenceStatus("2026-07-27", null, null, "America/Chicago", now),
    ).toBe("upcoming");
  });
});
