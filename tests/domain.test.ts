import { describe, expect, it } from "vitest";
import { assembleCommandData } from "../lib/server/command-service";
import { buildAlerts, buildDailyBriefing } from "../lib/domain/briefing";
import {
  parsePriorityInput,
  parseTimelineInput,
  ValidationError,
} from "../lib/domain/validation";
import type { Priority, TimelineItem } from "../lib/domain/types";

const now = new Date("2026-07-26T15:00:00.000Z");

function priority(overrides: Partial<Priority> = {}): Priority {
  return {
    id: "priority-1",
    title: "Protect focus block",
    dueAt: "2026-07-26T14:00:00.000Z",
    status: "active",
    position: 0,
    source: "local",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    completedAt: null,
    ...overrides,
  };
}

function timeline(overrides: Partial<TimelineItem> = {}): TimelineItem {
  return {
    id: "timeline-1",
    title: "Mobility",
    kind: "routine",
    status: "scheduled",
    startAt: "2026-07-26T13:00:00.000Z",
    endAt: null,
    localDate: "2026-07-26",
    timeZone: "America/Chicago",
    notes: "",
    source: "local",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

describe("Command domain rules", () => {
  it("prioritizes actual overdue conditions without inventing healthy states", () => {
    const alerts = buildAlerts([priority()], [timeline()], now);
    expect(alerts.map((item) => item.kind)).toEqual(["overdue", "review"]);
  });

  it("builds an honest empty briefing without Atlas", () => {
    const briefing = buildDailyBriefing([], [], [], now);
    expect(briefing.summary).toContain("Nothing is scheduled yet");
    expect(briefing.nextCommitment).toBeNull();
  });

  it("isolates a failed surface and returns partial Command data", async () => {
    const data = await assembleCommandData(
      "2026-07-26",
      "America/Chicago",
      {
        priorities: async () => {
          throw new Error("simulated failure");
        },
        timeline: async () => [timeline()],
      },
      now,
    );

    expect(data.priorities.state).toBe("error");
    expect(data.timeline.state).toBe("loaded");
    expect(data.briefing.state).toBe("partial");
  });
});

describe("boundary validation", () => {
  it("normalizes priority input and rejects missing values", () => {
    expect(parsePriorityInput({ title: "  Train with intent  " })).toEqual({
      title: "Train with intent",
      notes: "",
      dueAt: null,
      isTop: true,
      scheduledStartAt: null,
      scheduledEndAt: null,
      reminderEnabled: false,
      reminderOffsetMinutes: null,
    });
    expect(() => parsePriorityInput({ title: " " })).toThrow(ValidationError);
  });

  it("requires explicit time context for timed items", () => {
    expect(() =>
      parseTimelineInput({
        title: "Appointment",
        kind: "event",
        localDate: "2026-07-26",
        timeZone: "America/Chicago",
      }),
    ).toThrow("start time");
  });

  it("accepts all-day items without fabricating a time", () => {
    expect(
      parseTimelineInput({
        title: "Personal reset",
        kind: "all-day",
        localDate: "2026-07-26",
        timeZone: "America/Chicago",
      }).startAt,
    ).toBeNull();
  });
});
