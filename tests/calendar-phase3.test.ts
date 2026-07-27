import { afterEach, describe, expect, it } from "vitest";
import {
  deterministicAnswer,
  deterministicCapture,
  findAvailability,
} from "../lib/calendar-intelligence/deterministic";
import { atlasCapture } from "../lib/server/atlas-calendar";
import {
  createOAuthState,
  googleCalendarConfiguration,
  verifyOAuthState,
} from "../lib/server/calendar-secrets";
import {
  GOOGLE_CALENDAR_SCOPES,
  googleAuthorizationUrl,
  googleEventToCalendarInput,
} from "../lib/server/google-calendar";
import type { CalendarEvent } from "../lib/time/types";
import { FakeTimeApi } from "./fixtures";

const originalEnvironment = {
  openAi: process.env.OPENAI_API_KEY,
  clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
  stateSecret: process.env.NEXUS_OAUTH_STATE_SECRET,
  encryptionKey: process.env.NEXUS_CREDENTIAL_ENCRYPTION_KEY,
};

afterEach(() => {
  process.env.OPENAI_API_KEY = originalEnvironment.openAi;
  process.env.GOOGLE_CALENDAR_CLIENT_ID = originalEnvironment.clientId;
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET = originalEnvironment.clientSecret;
  process.env.NEXUS_OAUTH_STATE_SECRET = originalEnvironment.stateSecret;
  process.env.NEXUS_CREDENTIAL_ENCRYPTION_KEY =
    originalEnvironment.encryptionKey;
});

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "event-1",
    occurrenceKey: "event-1",
    occurrenceDate: "2026-07-28",
    seriesId: null,
    title: "Client review",
    eventType: "meeting",
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
    localDate: "2026-07-28",
    endLocalDate: "2026-07-28",
    startTime: "12:00",
    endTime: "13:00",
    startAt: "2026-07-28T17:00:00.000Z",
    endAt: "2026-07-28T18:00:00.000Z",
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
    createdAt: "2026-07-26T12:00:00.000Z",
    updatedAt: "2026-07-26T12:00:00.000Z",
    ...overrides,
  };
}

describe("Calendar Phase 3 deterministic intelligence", () => {
  const preferences = new FakeTimeApi().preferences;

  it("parses relative dates, ambiguous shorthand time, duration, and ISO dates", () => {
    const relative = deterministicCapture(
      "Client meeting next Tuesday at 2 for one hour",
      preferences,
      new Date("2026-07-26T17:00:00.000Z"),
    );
    expect(relative.event).toMatchObject({
      eventType: "meeting",
      localDate: "2026-07-28",
      startTime: "14:00",
      endTime: "15:00",
    });
    expect(relative.ambiguities).toContain("2 was interpreted as PM.");

    const exact = deterministicCapture(
      "Personal focus on 2026-08-03 at 09:30 for 30 minutes",
      preferences,
      new Date("2026-07-26T17:00:00.000Z"),
    );
    expect(exact.event).toMatchObject({
      localDate: "2026-08-03",
      startTime: "09:30",
      endTime: "10:00",
    });
    expect(exact.ambiguities).toEqual([]);
  });

  it("applies safe birthday defaults without mutating a calendar", () => {
    const result = deterministicCapture(
      "Jordan birthday August 12",
      preferences,
      new Date("2026-07-26T17:00:00.000Z"),
    );
    expect(result.event).toMatchObject({
      eventType: "birthday",
      allDay: true,
      localDate: "2026-08-12",
      recurrence: { frequency: "yearly" },
    });
    expect(result.engine).toBe("deterministic");
  });

  it("finds availability only after applying the transition buffer", () => {
    const slots = findAvailability([event()], preferences, {
      durationMinutes: 60,
      startDate: "2026-07-28",
      endDate: "2026-07-28",
      preferredPeriod: "afternoon",
    });
    expect(slots.some((slot) => slot.startTime === "12:00")).toBe(false);
    expect(slots.some((slot) => slot.startTime === "13:00")).toBe(false);
    expect(slots[0]).toMatchObject({
      startTime: "13:15",
      endTime: "14:15",
    });
    expect(slots[0].reason).toContain("15-minute transition buffer");
  });

  it("grounds answers in linkable facts and does not claim an action", () => {
    const answer = deterministicAnswer(
      "What is next?",
      [event()],
      preferences,
      new Date("2026-07-26T17:00:00.000Z"),
    );
    expect(answer.answer).toContain("Client review");
    expect(answer.facts).toEqual([
      {
        eventId: "event-1",
        occurrenceKey: "event-1",
        label: "Client review",
        localDate: "2026-07-28",
      },
    ]);
    expect(answer.engine).toBe("deterministic");
  });

  it("uses deterministic capture when Atlas is not configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await atlasCapture(
      "Workout tomorrow at 7am for one hour",
      preferences,
      new Date("2026-07-26T17:00:00.000Z"),
    );
    expect(result.engine).toBe("deterministic");
    expect(result.event).toMatchObject({
      eventType: "workout",
      localDate: "2026-07-27",
      startTime: "07:00",
    });
  });
});

describe("Calendar Phase 3 provider security and normalization", () => {
  it("normalizes Google all-day exclusive ends and protects private content", () => {
    const result = googleEventToCalendarInput(
      {
        id: "external-1",
        summary: "Private planning\u0000",
        description: "Provider-only details",
        visibility: "private",
        start: { date: "2026-08-01" },
        end: { date: "2026-08-03" },
        organizer: { displayName: "Jordan Organizer" },
        attendees: [
          {
            email: "owner@example.com",
            responseStatus: "accepted",
            self: true,
          },
        ],
        extendedProperties: {
          private: {
            nexusPreparationChecklist: JSON.stringify(["Bring insurance card"]),
          },
        },
      },
      "America/Chicago",
    );
    expect(result).toMatchObject({
      title: "Private planning",
      allDay: true,
      localDate: "2026-08-01",
      endLocalDate: "2026-08-02",
      notes: "",
      sensitive: true,
      organizer: "Jordan Organizer",
      attendees: [
        {
          displayName: "",
          email: "owner@example.com",
          responseStatus: "accepted",
          self: true,
        },
      ],
      preparationChecklist: ["Bring insurance card"],
    });
  });

  it("signs OAuth state, rejects tampering, and validates connector secrets", async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "client";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "secret";
    process.env.NEXUS_OAUTH_STATE_SECRET = "s".repeat(32);
    process.env.NEXUS_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
      "base64",
    );
    expect(googleCalendarConfiguration().configured).toBe(true);
    const authorization = new URL(
      googleAuthorizationUrl({
        redirectUri: "https://nexus.example/api/calendar/google/callback",
        state: "signed-state",
      }),
    );
    expect(authorization.origin).toBe("https://accounts.google.com");
    expect(authorization.searchParams.get("scope")?.split(" ")).toEqual([
      ...GOOGLE_CALENDAR_SCOPES,
    ]);
    expect(authorization.searchParams.get("access_type")).toBe("offline");

    const state = await createOAuthState({
      nonce: "nonce",
      returnTo: "/calendar",
      expiresAt: Date.now() + 60_000,
    });
    await expect(verifyOAuthState(state)).resolves.toMatchObject({
      nonce: "nonce",
      returnTo: "/calendar",
    });
    const [payload, signature] = state.split(".");
    const replacement = signature[0] === "a" ? "b" : "a";
    await expect(
      verifyOAuthState(`${payload}.${replacement}${signature.slice(1)}`),
    ).rejects.toThrow("could not be verified");
    const expired = await createOAuthState({
      nonce: "nonce",
      returnTo: "/calendar",
      expiresAt: Date.now() - 1,
    });
    await expect(verifyOAuthState(expired)).rejects.toThrow("expired");
    const unsafeReturn = await createOAuthState({
      nonce: "nonce",
      returnTo: "//attacker.example",
      expiresAt: Date.now() + 60_000,
    });
    await expect(verifyOAuthState(unsafeReturn)).rejects.toThrow("invalid");

    process.env.NEXUS_CREDENTIAL_ENCRYPTION_KEY = "not-a-key";
    expect(googleCalendarConfiguration()).toMatchObject({
      configured: false,
    });
  });
});
