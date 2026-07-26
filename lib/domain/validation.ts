import type {
  PriorityInput,
  PriorityUpdate,
  TimelineInput,
  TimelineKind,
  TimelineUpdate,
} from "./types";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TITLE = 160;
const MAX_NOTES = 1200;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("Request body must be an object.");
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`${label} is required.`);
  }
  const normalized = value.trim();
  if (normalized.length > max) {
    throw new ValidationError(`${label} must be ${max} characters or fewer.`);
  }
  return normalized;
}

function optionalIso(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new ValidationError(`${label} must be a valid date and time.`);
  }
  return new Date(value).toISOString();
}

function optionalText(value: unknown, max: number) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string") {
    throw new ValidationError("Text value is invalid.");
  }
  const normalized = value.trim();
  if (normalized.length > max) {
    throw new ValidationError(`Text must be ${max} characters or fewer.`);
  }
  return normalized;
}

function optionalBoolean(value: unknown, label: string, fallback: boolean) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") {
    throw new ValidationError(`${label} must be true or false.`);
  }
  return value;
}

function optionalMinutes(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null;
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 43_200) {
    throw new ValidationError(`${label} is invalid.`);
  }
  return minutes;
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

export function parsePriorityInput(value: unknown): PriorityInput {
  const input = record(value);
  const priority: PriorityInput = {
    title: text(input.title, "Priority", MAX_TITLE),
    notes: optionalText(input.notes, MAX_NOTES),
    dueAt: optionalIso(input.dueAt, "Due time"),
    isTop: optionalBoolean(input.isTop, "Top priority", true),
    scheduledStartAt: optionalIso(input.scheduledStartAt, "Focus start"),
    scheduledEndAt: optionalIso(input.scheduledEndAt, "Focus end"),
    reminderEnabled: optionalBoolean(
      input.reminderEnabled,
      "Reminder enabled",
      false,
    ),
    reminderOffsetMinutes: optionalMinutes(
      input.reminderOffsetMinutes,
      "Reminder timing",
    ),
  };
  if (
    priority.scheduledStartAt &&
    priority.scheduledEndAt &&
    Date.parse(priority.scheduledEndAt) <= Date.parse(priority.scheduledStartAt)
  ) {
    throw new ValidationError("Focus time must end after it starts.");
  }
  return priority;
}

export function parsePriorityUpdate(value: unknown): PriorityUpdate {
  const input = record(value);
  const update: PriorityUpdate = {};
  if ("title" in input) update.title = text(input.title, "Priority", MAX_TITLE);
  if ("notes" in input) update.notes = optionalText(input.notes, MAX_NOTES);
  if ("dueAt" in input) update.dueAt = optionalIso(input.dueAt, "Due time");
  if ("isTop" in input) {
    update.isTop = optionalBoolean(input.isTop, "Top priority", false);
  }
  if ("scheduledStartAt" in input) {
    update.scheduledStartAt = optionalIso(
      input.scheduledStartAt,
      "Focus start",
    );
  }
  if ("scheduledEndAt" in input) {
    update.scheduledEndAt = optionalIso(input.scheduledEndAt, "Focus end");
  }
  if ("archived" in input) {
    update.archived = optionalBoolean(input.archived, "Archived", false);
  }
  if ("reminderEnabled" in input) {
    update.reminderEnabled = optionalBoolean(
      input.reminderEnabled,
      "Reminder enabled",
      false,
    );
  }
  if ("reminderOffsetMinutes" in input) {
    update.reminderOffsetMinutes = optionalMinutes(
      input.reminderOffsetMinutes,
      "Reminder timing",
    );
  }
  if ("status" in input) {
    if (input.status !== "active" && input.status !== "completed") {
      throw new ValidationError("Priority status is invalid.");
    }
    update.status = input.status;
  }
  if (
    update.scheduledStartAt &&
    update.scheduledEndAt &&
    Date.parse(update.scheduledEndAt) <= Date.parse(update.scheduledStartAt)
  ) {
    throw new ValidationError("Focus time must end after it starts.");
  }
  if (!Object.keys(update).length) {
    throw new ValidationError("No priority changes were provided.");
  }
  return update;
}

export function parseTimelineInput(value: unknown): TimelineInput {
  const input = record(value);
  const kind = input.kind as TimelineKind;
  if (!["event", "all-day", "routine"].includes(kind)) {
    throw new ValidationError("Timeline item type is invalid.");
  }
  if (typeof input.localDate !== "string" || !DATE_KEY.test(input.localDate)) {
    throw new ValidationError("Local date must use YYYY-MM-DD.");
  }
  const startAt = optionalIso(input.startAt, "Start time");
  const endAt = optionalIso(input.endAt, "End time");
  if (kind !== "all-day" && !startAt) {
    throw new ValidationError("A start time is required for timed items.");
  }
  if (startAt && endAt && Date.parse(endAt) <= Date.parse(startAt)) {
    throw new ValidationError("End time must be after start time.");
  }
  return {
    title: text(input.title, "Timeline item", MAX_TITLE),
    kind,
    startAt,
    endAt,
    localDate: input.localDate,
    timeZone: timeZone(input.timeZone),
    notes: optionalText(input.notes, MAX_NOTES),
  };
}

export function parseTimelineUpdate(value: unknown): TimelineUpdate {
  const input = record(value);
  if ("status" in input) {
    if (!["scheduled", "completed", "skipped"].includes(String(input.status))) {
      throw new ValidationError("Timeline status is invalid.");
    }
  }
  if ("status" in input && Object.keys(input).length === 1) {
    return { status: input.status as TimelineUpdate["status"] };
  }
  return {
    ...parseTimelineInput(input),
    ...(input.status
      ? { status: input.status as TimelineUpdate["status"] }
      : {}),
  };
}

export function parseReorder(value: unknown) {
  const ids = record(value).ids;
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 3 ||
    ids.some((id) => typeof id !== "string")
  ) {
    throw new ValidationError("Priority order is invalid.");
  }
  if (new Set(ids).size !== ids.length) {
    throw new ValidationError("Priority order contains duplicates.");
  }
  return ids as string[];
}

export function parseCapture(value: unknown) {
  const content = text(record(value).content, "Capture", 2000);
  return { content };
}
