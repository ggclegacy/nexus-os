import { ValidationError } from "../domain/validation";
import type {
  CalendarEventInput,
  CalendarEventType,
  RecurrenceEditScope,
  RecurrenceRule,
  RoutineInput,
  RoutineOccurrenceStatus,
  TimePreferences,
} from "./types";
import { eventTypeDefaults } from "./event-types";
import { assertDateKey, assertTimeKey, zonedDateTimeToUtc } from "./rules";

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
  const normalized = value.trim();
  if (normalized.length > max) {
    throw new ValidationError(`${label} must be ${max} characters or fewer.`);
  }
  return normalized;
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

function optionalBoolean(value: unknown, label: string, fallback: boolean) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") {
    throw new ValidationError(`${label} must be true or false.`);
  }
  return value;
}

function attendees(
  value: unknown,
): NonNullable<CalendarEventInput["attendees"]> {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 100) {
    throw new ValidationError(
      "Attendees must contain no more than 100 people.",
    );
  }
  return value.map((entry) => {
    const attendee = record(entry);
    return {
      displayName: optionalText(
        attendee.displayName,
        "Attendee display name",
        160,
      ),
      email: optionalText(attendee.email, "Attendee email", 320),
      responseStatus: optionalText(
        attendee.responseStatus,
        "Attendee response",
        80,
      ),
      self: optionalBoolean(attendee.self, "Attendee self marker", false),
    };
  });
}

function preparationChecklist(value: unknown) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 20) {
    throw new ValidationError(
      "Preparation checklist must contain no more than 20 items.",
    );
  }
  const items = value.map((item) =>
    requiredText(item, "Preparation item", 240),
  );
  return [...new Set(items)];
}

export function parseDateKey(value: unknown, label: string) {
  return date(value, label);
}

export function parseRecurrence(value: unknown): RecurrenceRule | null {
  if (value === null || value === undefined || value === "") return null;
  const input = record(value);
  if (
    !["daily", "weekly", "monthly", "yearly"].includes(String(input.frequency))
  ) {
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
  const monthlyMode = ["date", "relative", "last-day"].includes(
    String(input.monthlyMode),
  )
    ? (input.monthlyMode as RecurrenceRule["monthlyMode"])
    : ("date" as const);
  const monthlyWeekday =
    input.monthlyWeekday === null || input.monthlyWeekday === undefined
      ? null
      : Number(input.monthlyWeekday);
  if (
    monthlyWeekday !== null &&
    (!Number.isInteger(monthlyWeekday) ||
      monthlyWeekday < 0 ||
      monthlyWeekday > 6)
  ) {
    throw new ValidationError("Monthly weekday is invalid.");
  }
  const monthlyOrdinal =
    input.monthlyOrdinal === null || input.monthlyOrdinal === undefined
      ? null
      : Number(input.monthlyOrdinal);
  if (monthlyOrdinal !== null && ![1, 2, 3, 4, -1].includes(monthlyOrdinal)) {
    throw new ValidationError("Monthly position is invalid.");
  }
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
    monthlyWeekday,
    monthlyOrdinal: monthlyOrdinal as RecurrenceRule["monthlyOrdinal"],
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
  const eventTypes: CalendarEventType[] = [
    "personal",
    "medical",
    "financial",
    "meeting",
    "workout",
    "protocol",
    "family",
    "birthday",
    "travel",
    "reminder",
    "custom",
  ];
  if (
    input.eventType !== undefined &&
    !eventTypes.includes(input.eventType as CalendarEventType)
  ) {
    throw new ValidationError("Event type is invalid.");
  }
  const eventType = (input.eventType ?? "personal") as CalendarEventType;
  const defaults = eventTypeDefaults(eventType);
  const allDay = optionalBoolean(
    input.allDay,
    "All-day setting",
    defaults.allDay,
  );
  const localDate = date(input.localDate, "Start date");
  const endLocalDate = date(input.endLocalDate ?? input.localDate, "End date");
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
    let startAt: string;
    let endAt: string;
    try {
      startAt = zonedDateTimeToUtc(localDate, startTime, zone);
      endAt = zonedDateTimeToUtc(endLocalDate, endTime, zone);
    } catch (error) {
      throw new ValidationError(
        error instanceof Error
          ? error.message
          : "The event time is invalid for its time zone.",
      );
    }
    if (Date.parse(endAt) <= Date.parse(startAt)) {
      throw new ValidationError("Event end must be after its start.");
    }
  }
  const status =
    input.status === undefined
      ? "scheduled"
      : ["scheduled", "completed", "dismissed", "cancelled"].includes(
            String(input.status),
          )
        ? (input.status as CalendarEventInput["status"])
        : null;
  if (!status) throw new ValidationError("Event status is invalid.");
  const recurrence =
    input.recurrence === undefined
      ? defaults.recurrence
      : parseRecurrence(input.recurrence);
  if (recurrence?.until && recurrence.until < localDate) {
    throw new ValidationError("Recurrence end must not precede its start.");
  }
  const meetingUrl = optionalText(
    input.meetingUrl,
    "Meeting link",
    MAX_LOCATION,
  );
  if (meetingUrl) {
    try {
      const parsed = new URL(meetingUrl);
      if (!["https:", "http:"].includes(parsed.protocol)) throw new Error();
    } catch {
      throw new ValidationError("Meeting link must be a valid web address.");
    }
  }
  const amount =
    input.amount === null || input.amount === undefined || input.amount === ""
      ? null
      : Number(input.amount);
  if (
    amount !== null &&
    (!Number.isFinite(amount) ||
      amount < 0 ||
      amount > 1_000_000_000 ||
      Math.round(amount * 100) !== amount * 100)
  ) {
    throw new ValidationError(
      "Amount must be a positive value with no more than two decimal places.",
    );
  }
  const currency =
    typeof input.currency === "string" && /^[A-Za-z]{3}$/.test(input.currency)
      ? input.currency.toUpperCase()
      : "USD";
  const paymentStatus =
    input.paymentStatus === null || input.paymentStatus === undefined
      ? eventType === "financial"
        ? "unpaid"
        : null
      : ["unpaid", "paid"].includes(String(input.paymentStatus))
        ? (input.paymentStatus as CalendarEventInput["paymentStatus"])
        : null;
  if (
    input.paymentStatus !== null &&
    input.paymentStatus !== undefined &&
    paymentStatus === null
  ) {
    throw new ValidationError("Payment status is invalid.");
  }
  const priority = ["standard", "important", "critical"].includes(
    String(input.priority ?? "standard"),
  )
    ? ((input.priority ?? "standard") as CalendarEventInput["priority"])
    : null;
  if (!priority) throw new ValidationError("Event priority is invalid.");
  const birthYear =
    input.birthYear === null ||
    input.birthYear === undefined ||
    input.birthYear === ""
      ? null
      : Number(input.birthYear);
  if (
    birthYear !== null &&
    (!Number.isInteger(birthYear) ||
      birthYear < 1800 ||
      birthYear > new Date().getUTCFullYear())
  ) {
    throw new ValidationError("Birth year is invalid.");
  }
  const paidAt =
    input.paidAt === null || input.paidAt === undefined || input.paidAt === ""
      ? null
      : typeof input.paidAt === "string" &&
          Number.isFinite(Date.parse(input.paidAt))
        ? new Date(input.paidAt).toISOString()
        : null;
  if (input.paidAt && !paidAt) {
    throw new ValidationError("Paid date is invalid.");
  }
  return {
    title: requiredText(input.title, "Event title", MAX_TITLE),
    eventType,
    notes: optionalText(input.notes, "Notes", MAX_NOTES),
    location: optionalText(input.location, "Location", MAX_LOCATION),
    provider: optionalText(input.provider, "Provider", 160),
    meetingUrl,
    amount,
    currency,
    paymentStatus,
    priority,
    status,
    allDay,
    localDate,
    endLocalDate,
    startTime,
    endTime,
    timeZone: zone,
    recurrence,
    reminderOffsets:
      input.reminderOffsets === undefined
        ? defaults.reminderOffsets
        : reminderOffsets(input.reminderOffsets),
    relationship: optionalText(input.relationship, "Relationship", 120),
    birthYear,
    giftIdea: optionalText(input.giftIdea, "Gift idea", 500),
    contactMethod: optionalText(
      input.contactMethod,
      "Preferred contact method",
      120,
    ),
    billCategory: optionalText(input.billCategory, "Bill category", 120),
    autopay: optionalBoolean(input.autopay, "Autopay", false),
    accountNote: optionalText(input.accountNote, "Account note", 500),
    paidAt,
    escalationEnabled: optionalBoolean(
      input.escalationEnabled,
      "Reminder escalation",
      true,
    ),
    sensitive: optionalBoolean(input.sensitive, "Sensitive event", false),
    organizer: optionalText(input.organizer, "Organizer", 320),
    attendees: attendees(input.attendees),
    preparationChecklist: preparationChecklist(input.preparationChecklist),
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
  const state =
    input.state === undefined
      ? "active"
      : ["active", "paused", "archived"].includes(String(input.state))
        ? (input.state as RoutineInput["state"])
        : null;
  if (!state) throw new ValidationError("Routine state is invalid.");
  const schedule = parseRecurrence(input.schedule);
  if (!schedule) throw new ValidationError("Routine schedule is required.");
  const startDate = date(input.startDate, "Start date");
  const endDate = optionalDate(input.endDate, "End date");
  if (endDate && endDate < startDate) {
    throw new ValidationError("Routine end must not precede its start.");
  }
  if (schedule.until && schedule.until < startDate) {
    throw new ValidationError("Routine recurrence end must not precede start.");
  }
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
    startDate,
    endDate,
    state,
    reminderEnabled: optionalBoolean(
      input.reminderEnabled,
      "Reminder enabled",
      false,
    ),
    reminderOffsetMinutes: reminderOffset,
  };
}

export function parseOccurrenceUpdate(value: unknown) {
  const input = record(value);
  if (
    !["upcoming", "due", "completed", "skipped"].includes(String(input.status))
  ) {
    throw new ValidationError("Routine occurrence status is invalid.");
  }
  return {
    status: input.status as Exclude<RoutineOccurrenceStatus, "missed">,
    note: optionalText(input.note, "Occurrence note", 600),
  };
}

export function parseTimePreferences(value: unknown): TimePreferences {
  const input = record(value);
  if (input.weekStartsOn !== 0 && input.weekStartsOn !== 1) {
    throw new ValidationError("Week start is invalid.");
  }
  const weekStartsOn = input.weekStartsOn;
  if (input.hourCycle !== "12" && input.hourCycle !== "24") {
    throw new ValidationError("Hour format is invalid.");
  }
  const hourCycle = input.hourCycle;
  if (!["delay", "suppress", "allow"].includes(String(input.quietBehavior))) {
    throw new ValidationError("Quiet-hours behavior is invalid.");
  }
  const quietBehavior = input.quietBehavior as TimePreferences["quietBehavior"];
  if (
    input.notificationPermission !== "denied" &&
    input.notificationPermission !== "in-app-only"
  ) {
    throw new ValidationError("Notification capability is invalid.");
  }
  const defaultView = ["day", "agenda", "week", "month"].includes(
    String(input.defaultView ?? "day"),
  )
    ? (input.defaultView as TimePreferences["defaultView"])
    : null;
  if (!defaultView)
    throw new ValidationError("Default Calendar view is invalid.");
  const integerSetting = (
    value: unknown,
    fallback: number,
    min: number,
    max: number,
    label: string,
  ) => {
    const result = value === undefined ? fallback : Number(value);
    if (!Number.isInteger(result) || result < min || result > max) {
      throw new ValidationError(`${label} is invalid.`);
    }
    return result;
  };
  return {
    timeZone: timeZone(input.timeZone),
    locale:
      typeof input.locale === "string" && input.locale.trim()
        ? optionalText(input.locale, "Locale", 30)
        : "en-US",
    weekStartsOn,
    hourCycle,
    quietHoursEnabled: optionalBoolean(
      input.quietHoursEnabled,
      "Quiet hours",
      false,
    ),
    quietHoursStart:
      optionalTime(input.quietHoursStart, "Quiet hours start") ?? "22:00",
    quietHoursEnd:
      optionalTime(input.quietHoursEnd, "Quiet hours end") ?? "07:00",
    quietBehavior,
    notificationPermission: input.notificationPermission,
    defaultView,
    defaultEventDurationMinutes: integerSetting(
      input.defaultEventDurationMinutes,
      60,
      15,
      480,
      "Default event duration",
    ),
    transitionBufferMinutes: integerSetting(
      input.transitionBufferMinutes,
      15,
      0,
      180,
      "Transition buffer",
    ),
    morningBriefTime:
      optionalTime(input.morningBriefTime, "Morning Brief time") ?? "07:00",
    eveningBriefTime:
      optionalTime(input.eveningBriefTime, "Evening Brief time") ?? "20:00",
    escalationEnabled: optionalBoolean(
      input.escalationEnabled,
      "Reminder escalation",
      true,
    ),
    defaultSnoozeMinutes: integerSetting(
      input.defaultSnoozeMinutes,
      60,
      15,
      1_440,
      "Default snooze",
    ),
    overloadMinutesPerDay: integerSetting(
      input.overloadMinutesPerDay,
      480,
      60,
      1_440,
      "Daily overload threshold",
    ),
    overloadImportantItemCount: integerSetting(
      input.overloadImportantItemCount,
      5,
      1,
      20,
      "Important-item overload threshold",
    ),
    updatedAt: new Date().toISOString(),
  };
}
