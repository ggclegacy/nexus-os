import { ValidationError } from "../domain/validation";
import type {
  CalendarEventInput,
  RecurrenceEditScope,
  RecurrenceRule,
  RoutineInput,
  RoutineOccurrenceStatus,
  TimePreferences,
} from "./types";
import {
  assertDateKey,
  assertTimeKey,
  zonedDateTimeToUtc,
} from "./rules";

const MAX_TITLE = 160;
const MAX_NOTES = 4_000;
const MAX_LOCATION = 240;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("Request body must be an object.");
  }
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`${label} is required.`);
  }
  const normalized = value.trim();
  if (normalized.length > max) {
    throw new ValidationError(`${label} must be ${max} characters or fewer.`);
  }
  return normalized;
}

function optionalText(value: unknown, label: string, max: number) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string") {
    throw new ValidationError(`${label} must be text.`);
  }
  return value.trim().slice(0, max);
}

function date(value: unknown, label: string) {
  if (typeof value !== "string") {
    throw new ValidationError(`${label} is required.`);
  }
  try {
    return assertDateKey(value);
  } catch {
    throw new ValidationError(`${label} is not a valid date.`);
  }
}

function optionalDate(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null;
  return date(value, label);
}

function optionalTime(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new ValidationError(`${label} must use HH:mm.`);
  }
  try {
    return assertTimeKey(value);
  } catch {
    throw new ValidationError(`${label} must use HH:mm.`);
  }
}

function timeZone(value: unknown) {
  if (typeof value !== "string" || !value) {
    throw new ValidationError("Time zone is required.");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
  } catch {
    throw new ValidationError("Time zone is not supported.");
  }
  return value;
}

export function parseRecurrence(value: unknown): RecurrenceRule | null {
  if (value === null || value === undefined || value === "") return null;
  const input = record(value);
  if (!["daily", "weekly", "monthly", "yearly"].includes(String(input.frequency))) {
    throw new ValidationError("Recurrence frequency is invalid.");
  }
  const interval = Number(input.interval ?? 1);
  if (!Number.isInteger(interval) || interval < 1 || interval > 365) {
    throw new ValidationError("Recurrence interval must be between 1 and 365.");
  }
  const weekdays = Array.isArray(input.weekdays)
    ? input.weekdays.map(Number)
    : [];
  if (
    weekdays.length > 7 ||
    weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  ) {
    throw new ValidationError("Selected weekdays are invalid.");
  }
  const monthlyMode =
    input.monthlyMode === "relative" ? "relative" : ("date" as const);
  const count =
    input.count === null || input.count === undefined || input.count === ""
      ? null
      : Number(input.count);
  if (
    count !== null &&
    (!Number.isInteger(count) || count < 1 || count > 1_000)
  ) {
    throw new ValidationError("Occurrence count must be between 1 and 1000.");
  }
  return {
    frequency: input.frequency as RecurrenceRule["frequency"],
    interval,
    weekdays: [...new Set(weekdays)].sort(),
    monthlyMode,
    until: optionalDate(input.until, "Recurrence end"),
    count,
  };
}

function reminderOffsets(value: unknown) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 5) {
    throw new ValidationError("Reminder timing is invalid.");
  }
  const offsets = value.map(Number);
  if (
    offsets.some(
      (offset) =>
        !Number.isInteger(offset) || offset < 0 || offset > 60 * 24 * 30,
    )
  ) {
    throw new ValidationError("Reminder timing is invalid.");
  }
  return [...new Set(offsets)].sort((a, b) => a - b);
}

export function parseCalendarEvent(value: unknown): CalendarEventInput {
  const input = record(value);
  const allDay = Boolean(input.allDay);
  const localDate = date(input.localDate, "Start date");
  const endLocalDate = date(
    input.endLocalDate ?? input.localDate,
    "End date",
  );
  if (endLocalDate < localDate) {
    throw new ValidationError("End date must not precede start date.");
  }
  const zone = timeZone(input.timeZone);
  const startTime = allDay ? null : optionalTime(input.startTime, "Start time");
  const endTime = allDay ? null : optionalTime(input.endTime, "End time");
  if (!allDay && (!startTime || !endTime)) {
    throw new ValidationError("Start and end times are required.");
  }
  if (!allDay && startTime && endTime) {
    const startAt = zonedDateTimeToUtc(localDate, startTime, zone);
    const endAt = zonedDateTimeToUtc(endLocalDate, endTime, zone);
    if (Date.parse(endAt) <= Date.parse(startAt)) {
      throw new ValidationError("Event end must be after its start.");
    }
  }
  const status = ["confirmed", "tentative", "canceled"].includes(
    String(input.status),
  )
    ? (input.status as CalendarEventInput["status"])
    : "confirmed";
  return {
    title: requiredText(input.title, "Event title", MAX_TITLE),
    notes: optionalText(input.notes, "Notes", MAX_NOTES),
    location: optionalText(input.location, "Location", MAX_LOCATION),
    category:
      typeof input.category === "string" && input.category.trim()
        ? input.category.trim().slice(0, 40)
        : null,
    status,
    allDay,
    localDate,
    endLocalDate,
    startTime,
    endTime,
    timeZone: zone,
    recurrence: parseRecurrence(input.recurrence),
    reminderOffsets: reminderOffsets(input.reminderOffsets),
  };
}

export function parseRecurrenceScope(value: unknown): RecurrenceEditScope {
  if (!["occurrence", "future", "series"].includes(String(value))) {
    throw new ValidationError("Choose which recurring events to change.");
  }
  return value as RecurrenceEditScope;
}

export function parseRoutine(value: unknown): RoutineInput {
  const input = record(value);
  const preferredTime = optionalTime(input.preferredTime, "Preferred time");
  const windowStart = optionalTime(input.windowStart, "Window start");
  const windowEnd = optionalTime(input.windowEnd, "Window end");
  if (windowStart && windowEnd && windowStart >= windowEnd) {
    throw new ValidationError("Routine window end must be after its start.");
  }
  const expectedMinutes =
    input.expectedMinutes === null ||
    input.expectedMinutes === undefined ||
    input.expectedMinutes === ""
      ? null
      : Number(input.expectedMinutes);
  if (
    expectedMinutes !== null &&
    (!Number.isInteger(expectedMinutes) ||
      expectedMinutes < 1 ||
      expectedMinutes > 1_440)
  ) {
    throw new ValidationError("Expected duration must be 1–1440 minutes.");
  }
  const state = ["active", "paused", "archived"].includes(String(input.state))
    ? (input.state as RoutineInput["state"])
    : "active";
  const schedule = parseRecurrence(input.schedule);
  if (!schedule) throw new ValidationError("Routine schedule is required.");
  const reminderOffset =
    input.reminderOffsetMinutes === null ||
    input.reminderOffsetMinutes === undefined ||
    input.reminderOffsetMinutes === ""
      ? null
      : Number(input.reminderOffsetMinutes);
  if (
    reminderOffset !== null &&
    (!Number.isInteger(reminderOffset) ||
      reminderOffset < 0 ||
      reminderOffset > 43_200)
  ) {
    throw new ValidationError("Reminder timing is invalid.");
  }
  return {
    name: requiredText(input.name, "Routine name", MAX_TITLE),
    description: optionalText(input.description, "Description", MAX_NOTES),
    schedule,
    preferredTime,
    windowStart,
    windowEnd,
    expectedMinutes,
    startDate: date(input.startDate, "Start date"),
    endDate: optionalDate(input.endDate, "End date"),
    state,
    reminderEnabled: Boolean(input.reminderEnabled),
    reminderOffsetMinutes: reminderOffset,
  };
}

export function parseOccurrenceUpdate(value: unknown) {
  const input = record(value);
  if (!["upcoming", "due", "completed", "skipped"].includes(String(input.status))) {
    throw new ValidationError("Routine occurrence status is invalid.");
  }
  return {
    status: input.status as Exclude<RoutineOccurrenceStatus, "missed">,
    note: optionalText(input.note, "Occurrence note", 600),
  };
}

export function parseTimePreferences(value: unknown): TimePreferences {
  const input = record(value);
  const weekStartsOn = Number(input.weekStartsOn) === 0 ? 0 : 1;
  const hourCycle = input.hourCycle === "24" ? "24" : "12";
  const quietBehavior = ["delay", "suppress", "allow"].includes(
    String(input.quietBehavior),
  )
    ? (input.quietBehavior as TimePreferences["quietBehavior"])
    : "delay";
  return {
    timeZone: timeZone(input.timeZone),
    locale:
      typeof input.locale === "string" && input.locale.trim()
        ? input.locale.trim().slice(0, 30)
        : "en-US",
    weekStartsOn,
    hourCycle,
    quietHoursEnabled: Boolean(input.quietHoursEnabled),
    quietHoursStart:
      optionalTime(input.quietHoursStart, "Quiet hours start") ?? "22:00",
    quietHoursEnd:
      optionalTime(input.quietHoursEnd, "Quiet hours end") ?? "07:00",
    quietBehavior,
    notificationPermission:
      input.notificationPermission === "denied" ? "denied" : "in-app-only",
    updatedAt: new Date().toISOString(),
  };
}
