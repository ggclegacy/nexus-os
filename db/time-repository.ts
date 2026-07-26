import type { Priority, TimelineItem } from "../lib/domain/types";
import {
  addDays,
  daysBetween,
  expandRecurrence,
  localTimeInZone,
  routineOccurrenceStatus,
  zonedDateTimeToUtc,
} from "../lib/time/rules";
import type {
  CalendarEvent,
  CalendarEventInput,
  CalendarFilters,
  CalendarPayload,
  EventException,
  RecurrenceEditScope,
  RecurrenceRule,
  Reminder,
  Routine,
  RoutineInput,
  RoutineOccurrence,
  TimePreferences,
} from "../lib/time/types";
import {
  commandDatabase,
  ensureCommandSchema,
  listPriorities,
  type TimelineRow,
} from "./command-repository";

type EventExceptionRow = {
  id: string;
  series_id: string;
  original_date: string;
  kind: EventException["kind"];
  override_json: string;
  created_at: string;
  updated_at: string;
};

type RoutineRow = {
  id: string;
  name: string;
  description: string;
  recurrence_rule: string;
  preferred_time: string | null;
  window_start: string | null;
  window_end: string | null;
  expected_minutes: number | null;
  start_date: string;
  end_date: string | null;
  state: Routine["state"];
  reminder_enabled: number;
  reminder_offset_minutes: number | null;
  source: "local";
  created_at: string;
  updated_at: string;
};

type RoutineOccurrenceRow = {
  id: string;
  routine_id: string;
  scheduled_date: string;
  status: "upcoming" | "due" | "completed" | "skipped";
  completed_at: string | null;
  note: string;
  source: "local";
  updated_at: string;
};

type ReminderRow = {
  id: string;
  entity_type: Reminder["entityType"];
  entity_id: string;
  offset_minutes: number;
  channel: "in-app";
  enabled: number;
  quiet_behavior: Reminder["quietBehavior"];
  delivery_status: Reminder["deliveryStatus"];
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
};

type PreferencesRow = {
  time_zone: string;
  locale: string;
  week_starts_on: 0 | 1;
  hour_cycle: "12" | "24";
  quiet_hours_enabled: number;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_behavior: TimePreferences["quietBehavior"];
  notification_permission: TimePreferences["notificationPermission"];
  updated_at: string;
};

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function routineFromRow(row: RoutineRow): Routine {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    schedule: parseJson<RecurrenceRule>(row.recurrence_rule, {
      frequency: "daily",
      interval: 1,
      weekdays: [],
      monthlyMode: "date",
      until: null,
      count: null,
    }),
    preferredTime: row.preferred_time,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    expectedMinutes: row.expected_minutes,
    startDate: row.start_date,
    endDate: row.end_date,
    state: row.state,
    reminderEnabled: Boolean(row.reminder_enabled),
    reminderOffsetMinutes: row.reminder_offset_minutes,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function exceptionFromRow(row: EventExceptionRow): EventException {
  return {
    id: row.id,
    seriesId: row.series_id,
    originalDate: row.original_date,
    kind: row.kind,
    override: parseJson(row.override_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function reminderFromRow(row: ReminderRow): Reminder {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    offsetMinutes: row.offset_minutes,
    channel: row.channel,
    enabled: Boolean(row.enabled),
    quietBehavior: row.quiet_behavior,
    deliveryStatus: row.delivery_status,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function preferencesFromRow(row: PreferencesRow): TimePreferences {
  return {
    timeZone: row.time_zone,
    locale: row.locale,
    weekStartsOn: row.week_starts_on,
    hourCycle: row.hour_cycle,
    quietHoursEnabled: Boolean(row.quiet_hours_enabled),
    quietHoursStart: row.quiet_hours_start,
    quietHoursEnd: row.quiet_hours_end,
    quietBehavior: row.quiet_behavior,
    notificationPermission: row.notification_permission,
    updatedAt: row.updated_at,
  };
}

function eventInputFromRow(row: TimelineRow): CalendarEventInput {
  return {
    title: row.title,
    notes: row.notes,
    location: row.location,
    category: row.category,
    status: row.event_status,
    allDay: row.kind === "all-day",
    localDate: row.local_date,
    endLocalDate: row.end_local_date ?? row.local_date,
    startTime:
      row.kind === "all-day"
        ? null
        : (row.start_time ??
          (row.start_at ? localTimeInZone(row.start_at, row.time_zone) : null)),
    endTime:
      row.kind === "all-day"
        ? null
        : (row.end_time ??
          (row.end_at ? localTimeInZone(row.end_at, row.time_zone) : null)),
    timeZone: row.time_zone,
    recurrence: parseJson<RecurrenceRule | null>(row.recurrence_rule, null),
    reminderOffsets: [],
  };
}

function materializeEvent(
  row: TimelineRow,
  occurrenceDate: string,
  reminderOffsets: number[],
  exception?: EventException,
): CalendarEvent | null {
  if (exception?.kind === "canceled") return null;
  const base = eventInputFromRow(row);
  const dayShift = daysBetween(base.localDate, occurrenceDate);
  const endLocalDate = addDays(base.endLocalDate, dayShift);
  const input = {
    ...base,
    localDate: occurrenceDate,
    endLocalDate,
    reminderOffsets,
    ...(exception?.override ?? {}),
  };
  const startAt =
    input.allDay || !input.startTime
      ? null
      : zonedDateTimeToUtc(input.localDate, input.startTime, input.timeZone);
  const endAt =
    input.allDay || !input.endTime
      ? null
      : zonedDateTimeToUtc(input.endLocalDate, input.endTime, input.timeZone);
  return {
    ...input,
    id: row.id,
    seriesId: row.recurrence_rule ? row.id : null,
    occurrenceDate,
    occurrenceKey: row.recurrence_rule
      ? `event:${row.id}:${occurrenceDate}`
      : row.id,
    startAt,
    endAt,
    source: row.source,
    sourceId: row.source_id,
    externalCalendarId: row.external_calendar_id,
    lastSyncedAt: row.last_synced_at,
    localVersion: row.local_version,
    remoteVersion: row.remote_version,
    readOnly: Boolean(row.read_only),
    conflictState: row.conflict_state,
    createdAt: row.created_at,
    updatedAt: exception?.updatedAt ?? row.updated_at,
  };
}

async function migrateLegacyRoutines() {
  const db = commandDatabase();
  const legacy = await db
    .prepare(
      `SELECT * FROM timeline_items
       WHERE kind = 'routine' AND migrated_to_routine_id IS NULL
       LIMIT 200`,
    )
    .all<TimelineRow>();
  for (const item of legacy.results) {
    const routineId = `legacy-${item.id}`;
    const now = new Date().toISOString();
    const rule: RecurrenceRule = {
      frequency: "daily",
      interval: 1,
      weekdays: [],
      monthlyMode: "date",
      until: item.local_date,
      count: 1,
    };
    await db.batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO routines
           (id, name, description, recurrence_rule, preferred_time,
            window_start, window_end, expected_minutes, start_date, end_date,
            state, reminder_enabled, reminder_offset_minutes, source,
            created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 'active', 0, NULL,
            'local', ?, ?)`,
        )
        .bind(
          routineId,
          item.title,
          item.notes,
          JSON.stringify(rule),
          item.start_at ? localTimeInZone(item.start_at, item.time_zone) : null,
          item.start_at ? localTimeInZone(item.start_at, item.time_zone) : null,
          item.end_at ? localTimeInZone(item.end_at, item.time_zone) : null,
          item.local_date,
          item.local_date,
          item.created_at,
          item.updated_at,
        ),
      db
        .prepare(
          `INSERT OR IGNORE INTO routine_occurrences
           (id, routine_id, scheduled_date, status, completed_at, note,
            source, updated_at)
           VALUES (?, ?, ?, ?, ?, '', 'local', ?)`,
        )
        .bind(
          `occurrence-${routineId}-${item.local_date}`,
          routineId,
          item.local_date,
          item.status === "completed"
            ? "completed"
            : item.status === "skipped"
              ? "skipped"
              : "due",
          item.status === "completed" ? item.updated_at : null,
          item.updated_at,
        ),
      db
        .prepare(
          `UPDATE timeline_items
           SET migrated_to_routine_id = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(routineId, now, item.id),
    ]);
  }
}

export async function ensureTimeSchema() {
  await ensureCommandSchema();
  await migrateLegacyRoutines();
}

async function listReminderRows() {
  await ensureTimeSchema();
  const result = await commandDatabase()
    .prepare("SELECT * FROM reminders ORDER BY created_at ASC LIMIT 1000")
    .all<ReminderRow>();
  return result.results.map(reminderFromRow);
}

export async function getTimePreferences() {
  await ensureTimeSchema();
  const row = await commandDatabase()
    .prepare("SELECT * FROM time_preferences WHERE id = 'default'")
    .first<PreferencesRow>();
  if (!row) throw new Error("Time preferences are unavailable.");
  return preferencesFromRow(row);
}

export async function updateTimePreferences(input: TimePreferences) {
  await ensureTimeSchema();
  const now = new Date().toISOString();
  await commandDatabase()
    .prepare(
      `UPDATE time_preferences
       SET time_zone = ?, locale = ?, week_starts_on = ?, hour_cycle = ?,
           quiet_hours_enabled = ?, quiet_hours_start = ?,
           quiet_hours_end = ?, quiet_behavior = ?,
           notification_permission = ?, updated_at = ?
       WHERE id = 'default'`,
    )
    .bind(
      input.timeZone,
      input.locale,
      input.weekStartsOn,
      input.hourCycle,
      input.quietHoursEnabled ? 1 : 0,
      input.quietHoursStart,
      input.quietHoursEnd,
      input.quietBehavior,
      input.notificationPermission,
      now,
    )
    .run();
  return getTimePreferences();
}

async function replaceReminders(
  entityType: Reminder["entityType"],
  entityId: string,
  offsets: number[],
) {
  const db = commandDatabase();
  await db
    .prepare("DELETE FROM reminders WHERE entity_type = ? AND entity_id = ?")
    .bind(entityType, entityId)
    .run();
  if (!offsets.length) return;
  const now = new Date().toISOString();
  await db.batch(
    offsets.map((offset) =>
      db
        .prepare(
          `INSERT INTO reminders
           (id, entity_type, entity_id, offset_minutes, channel, enabled,
            quiet_behavior, delivery_status, delivered_at, created_at,
            updated_at)
           VALUES (?, ?, ?, ?, 'in-app', 1, 'delay', 'pending', NULL, ?, ?)`,
        )
        .bind(crypto.randomUUID(), entityType, entityId, offset, now, now),
    ),
  );
}

async function getEventRow(id: string) {
  await ensureTimeSchema();
  return commandDatabase()
    .prepare(
      `SELECT * FROM timeline_items
       WHERE id = ? AND kind != 'routine' AND deleted_at IS NULL`,
    )
    .bind(id)
    .first<TimelineRow>();
}

async function writeEvent(
  id: string,
  input: CalendarEventInput,
  createdAt = new Date().toISOString(),
) {
  const now = new Date().toISOString();
  const startAt =
    input.allDay || !input.startTime
      ? null
      : zonedDateTimeToUtc(input.localDate, input.startTime, input.timeZone);
  const endAt =
    input.allDay || !input.endTime
      ? null
      : zonedDateTimeToUtc(input.endLocalDate, input.endTime, input.timeZone);
  await commandDatabase()
    .prepare(
      `INSERT INTO timeline_items
       (id, title, kind, status, start_at, end_at, local_date, end_local_date,
        start_time, end_time, time_zone, notes, location, category,
        event_status, recurrence_rule, source, source_id,
        external_calendar_id, last_synced_at, local_version, remote_version,
        read_only, conflict_state, deleted_at, migrated_to_routine_id,
        created_at, updated_at)
       VALUES (?, ?, ?, 'scheduled', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        'local', NULL, NULL, NULL, 1, NULL, 0, 'none', NULL, NULL, ?, ?)`,
    )
    .bind(
      id,
      input.title,
      input.allDay ? "all-day" : "event",
      startAt,
      endAt,
      input.localDate,
      input.endLocalDate,
      input.startTime,
      input.endTime,
      input.timeZone,
      input.notes,
      input.location,
      input.category,
      input.status,
      input.recurrence ? JSON.stringify(input.recurrence) : null,
      createdAt,
      now,
    )
    .run();
  await replaceReminders("event", id, input.reminderOffsets);
  return id;
}

export async function createCalendarEvent(input: CalendarEventInput) {
  await ensureTimeSchema();
  const id = crypto.randomUUID();
  await writeEvent(id, input);
  return getCalendarEventOccurrence(id, input.localDate);
}

async function updateSeriesRow(id: string, input: CalendarEventInput) {
  const now = new Date().toISOString();
  const startAt =
    input.allDay || !input.startTime
      ? null
      : zonedDateTimeToUtc(input.localDate, input.startTime, input.timeZone);
  const endAt =
    input.allDay || !input.endTime
      ? null
      : zonedDateTimeToUtc(input.endLocalDate, input.endTime, input.timeZone);
  await commandDatabase()
    .prepare(
      `UPDATE timeline_items
       SET title = ?, kind = ?, start_at = ?, end_at = ?, local_date = ?,
           end_local_date = ?, start_time = ?, end_time = ?, time_zone = ?,
           notes = ?, location = ?, category = ?, event_status = ?,
           recurrence_rule = ?, local_version = local_version + 1,
           conflict_state = 'none', updated_at = ?
       WHERE id = ? AND read_only = 0`,
    )
    .bind(
      input.title,
      input.allDay ? "all-day" : "event",
      startAt,
      endAt,
      input.localDate,
      input.endLocalDate,
      input.startTime,
      input.endTime,
      input.timeZone,
      input.notes,
      input.location,
      input.category,
      input.status,
      input.recurrence ? JSON.stringify(input.recurrence) : null,
      now,
      id,
    )
    .run();
  await replaceReminders("event", id, input.reminderOffsets);
}

async function upsertException(
  seriesId: string,
  originalDate: string,
  kind: EventException["kind"],
  override: Partial<CalendarEventInput>,
) {
  const now = new Date().toISOString();
  const existing = await commandDatabase()
    .prepare(
      `SELECT id FROM event_exceptions
       WHERE series_id = ? AND original_date = ?`,
    )
    .bind(seriesId, originalDate)
    .first<{ id: string }>();
  if (existing) {
    await commandDatabase()
      .prepare(
        `UPDATE event_exceptions
         SET kind = ?, override_json = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(kind, JSON.stringify(override), now, existing.id)
      .run();
    return;
  }
  await commandDatabase()
    .prepare(
      `INSERT INTO event_exceptions
       (id, series_id, original_date, kind, override_json, created_at,
        updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      seriesId,
      originalDate,
      kind,
      JSON.stringify(override),
      now,
      now,
    )
    .run();
}

export async function updateCalendarEvent(
  id: string,
  occurrenceDate: string,
  scope: RecurrenceEditScope,
  input: CalendarEventInput,
) {
  const row = await getEventRow(id);
  if (!row) return null;
  if (!row.recurrence_rule) {
    await updateSeriesRow(id, input);
    return getCalendarEventOccurrence(id, input.localDate);
  }
  if (scope === "occurrence") {
    const seriesRule = parseJson<RecurrenceRule>(
      row.recurrence_rule,
      input.recurrence ?? {
        frequency: "daily",
        interval: 1,
        weekdays: [],
        monthlyMode: "date",
        until: null,
        count: null,
      },
    );
    await upsertException(id, occurrenceDate, "edited", {
      ...input,
      recurrence: seriesRule,
    });
    return getCalendarEventOccurrence(id, occurrenceDate);
  }
  if (scope === "series") {
    await updateSeriesRow(id, input);
    return getCalendarEventOccurrence(id, input.localDate);
  }

  const oldRule = parseJson<RecurrenceRule>(row.recurrence_rule, {
    frequency: "daily",
    interval: 1,
    weekdays: [],
    monthlyMode: "date",
    until: null,
    count: null,
  });
  await commandDatabase()
    .prepare(
      `UPDATE timeline_items
       SET recurrence_rule = ?, local_version = local_version + 1,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      JSON.stringify({
        ...oldRule,
        until: addDays(occurrenceDate, -1),
        count: null,
      }),
      new Date().toISOString(),
      id,
    )
    .run();
  const newId = crypto.randomUUID();
  await writeEvent(newId, { ...input, localDate: occurrenceDate });
  await commandDatabase()
    .prepare(
      `UPDATE event_exceptions
       SET series_id = ?, updated_at = ?
       WHERE series_id = ? AND original_date >= ?`,
    )
    .bind(newId, new Date().toISOString(), id, occurrenceDate)
    .run();
  return getCalendarEventOccurrence(newId, occurrenceDate);
}

export async function deleteCalendarEvent(
  id: string,
  occurrenceDate: string,
  scope: RecurrenceEditScope,
) {
  const row = await getEventRow(id);
  if (!row) return null;
  if (!row.recurrence_rule || scope === "series") {
    const db = commandDatabase();
    const now = new Date().toISOString();
    await db.batch([
      db
        .prepare(
          `UPDATE timeline_items
           SET deleted_at = ?, updated_at = ?,
               local_version = local_version + 1
           WHERE id = ? AND read_only = 0`,
        )
        .bind(now, now, id),
      db
        .prepare(
          "DELETE FROM reminders WHERE entity_type = 'event' AND entity_id = ?",
        )
        .bind(id),
    ]);
    return { id, scope: "series" as const };
  }
  if (scope === "occurrence") {
    await upsertException(id, occurrenceDate, "canceled", {});
    return { id, scope };
  }
  const rule = parseJson<RecurrenceRule>(row.recurrence_rule, {
    frequency: "daily",
    interval: 1,
    weekdays: [],
    monthlyMode: "date",
    until: null,
    count: null,
  });
  await commandDatabase()
    .prepare(
      `UPDATE timeline_items
       SET recurrence_rule = ?, updated_at = ?, local_version = local_version + 1
       WHERE id = ?`,
    )
    .bind(
      JSON.stringify({
        ...rule,
        until: addDays(occurrenceDate, -1),
        count: null,
      }),
      new Date().toISOString(),
      id,
    )
    .run();
  return { id, scope };
}

export async function listCalendarEvents(rangeStart: string, rangeEnd: string) {
  await ensureTimeSchema();
  const rows = await commandDatabase()
    .prepare(
      `SELECT * FROM timeline_items
       WHERE kind != 'routine' AND deleted_at IS NULL
         AND local_date <= ?
         AND (recurrence_rule IS NOT NULL OR
              COALESCE(end_local_date, local_date) >= ?)
       ORDER BY local_date ASC, start_at ASC
       LIMIT 500`,
    )
    .bind(rangeEnd, rangeStart)
    .all<TimelineRow>();
  const exceptions = await commandDatabase()
    .prepare(
      `SELECT * FROM event_exceptions
       ORDER BY original_date ASC
       LIMIT 1000`,
    )
    .all<EventExceptionRow>();
  const exceptionMap = new Map(
    exceptions.results.map((row) => {
      const exception = exceptionFromRow(row);
      return [`${exception.seriesId}:${exception.originalDate}`, exception];
    }),
  );
  const reminders = await listReminderRows();
  const reminderMap = new Map<string, number[]>();
  for (const reminder of reminders) {
    if (reminder.entityType !== "event" || !reminder.enabled) continue;
    reminderMap.set(reminder.entityId, [
      ...(reminderMap.get(reminder.entityId) ?? []),
      reminder.offsetMinutes,
    ]);
  }

  const events: CalendarEvent[] = [];
  const materializedKeys = new Set<string>();
  for (const row of rows.results) {
    const rule = parseJson<RecurrenceRule | null>(row.recurrence_rule, null);
    // A multi-day one-off may begin before the visible range. Materialize its
    // canonical start once; view grouping then renders each overlapping day.
    const dates = rule
      ? expandRecurrence(row.local_date, rangeStart, rangeEnd, rule)
      : [row.local_date];
    for (const occurrenceDate of dates) {
      const event = materializeEvent(
        row,
        occurrenceDate,
        reminderMap.get(row.id) ?? [],
        exceptionMap.get(`${row.id}:${occurrenceDate}`),
      );
      if (event) {
        events.push(event);
        materializedKeys.add(event.occurrenceKey);
      }
    }

    // An edited exception may be moved into this range from an occurrence
    // whose original date is outside it. Materialize that exception once.
    for (const exceptionRow of exceptions.results) {
      if (exceptionRow.series_id !== row.id) continue;
      const exception = exceptionFromRow(exceptionRow);
      if (exception.kind !== "edited") continue;
      const movedDate = exception.override.localDate;
      if (!movedDate || movedDate < rangeStart || movedDate > rangeEnd)
        continue;
      const event = materializeEvent(
        row,
        exception.originalDate,
        reminderMap.get(row.id) ?? [],
        exception,
      );
      if (event && !materializedKeys.has(event.occurrenceKey)) {
        events.push(event);
        materializedKeys.add(event.occurrenceKey);
      }
    }
  }
  return events.sort((a, b) => {
    if (a.localDate !== b.localDate)
      return a.localDate.localeCompare(b.localDate);
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return (a.startAt ?? "").localeCompare(b.startAt ?? "");
  });
}

export async function getCalendarEventOccurrence(
  id: string,
  occurrenceDate: string,
) {
  const events = await listCalendarEvents(occurrenceDate, occurrenceDate);
  return (
    events.find(
      (event) => event.id === id && event.occurrenceDate === occurrenceDate,
    ) ?? null
  );
}

export async function findEventConflicts(
  input: CalendarEventInput,
  excludeId?: string,
) {
  if (input.allDay || !input.startTime || !input.endTime) return [];
  const candidateStart = Date.parse(
    zonedDateTimeToUtc(input.localDate, input.startTime, input.timeZone),
  );
  const candidateEnd = Date.parse(
    zonedDateTimeToUtc(input.endLocalDate, input.endTime, input.timeZone),
  );
  const events = await listCalendarEvents(input.localDate, input.endLocalDate);
  return events.filter((event) => {
    if (
      event.id === excludeId ||
      event.allDay ||
      !event.startAt ||
      !event.endAt
    )
      return false;
    return (
      candidateStart < Date.parse(event.endAt) &&
      candidateEnd > Date.parse(event.startAt)
    );
  });
}

export async function listRoutines() {
  await ensureTimeSchema();
  const rows = await commandDatabase()
    .prepare(
      `SELECT * FROM routines
       ORDER BY CASE state WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
                updated_at DESC
       LIMIT 500`,
    )
    .all<RoutineRow>();
  return rows.results.map(routineFromRow);
}

export async function getRoutine(id: string) {
  await ensureTimeSchema();
  const row = await commandDatabase()
    .prepare("SELECT * FROM routines WHERE id = ?")
    .bind(id)
    .first<RoutineRow>();
  return row ? routineFromRow(row) : null;
}

export async function createRoutine(input: RoutineInput) {
  await ensureTimeSchema();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await commandDatabase()
    .prepare(
      `INSERT INTO routines
       (id, name, description, recurrence_rule, preferred_time, window_start,
        window_end, expected_minutes, start_date, end_date, state,
        reminder_enabled, reminder_offset_minutes, source, created_at,
        updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', ?, ?)`,
    )
    .bind(
      id,
      input.name,
      input.description,
      JSON.stringify(input.schedule),
      input.preferredTime,
      input.windowStart,
      input.windowEnd,
      input.expectedMinutes,
      input.startDate,
      input.endDate,
      input.state,
      input.reminderEnabled ? 1 : 0,
      input.reminderOffsetMinutes,
      now,
      now,
    )
    .run();
  if (input.reminderEnabled && input.reminderOffsetMinutes !== null) {
    await replaceReminders("routine", id, [input.reminderOffsetMinutes]);
  }
  return getRoutine(id);
}

export async function updateRoutine(id: string, input: RoutineInput) {
  const current = await getRoutine(id);
  if (!current) return null;
  const now = new Date().toISOString();
  await commandDatabase()
    .prepare(
      `UPDATE routines
       SET name = ?, description = ?, recurrence_rule = ?,
           preferred_time = ?, window_start = ?, window_end = ?,
           expected_minutes = ?, start_date = ?, end_date = ?, state = ?,
           reminder_enabled = ?, reminder_offset_minutes = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      input.name,
      input.description,
      JSON.stringify(input.schedule),
      input.preferredTime,
      input.windowStart,
      input.windowEnd,
      input.expectedMinutes,
      input.startDate,
      input.endDate,
      input.state,
      input.reminderEnabled ? 1 : 0,
      input.reminderOffsetMinutes,
      now,
      id,
    )
    .run();
  await replaceReminders(
    "routine",
    id,
    input.reminderEnabled && input.reminderOffsetMinutes !== null
      ? [input.reminderOffsetMinutes]
      : [],
  );
  return getRoutine(id);
}

export async function archiveRoutine(id: string) {
  const current = await getRoutine(id);
  if (!current) return null;
  const db = commandDatabase();
  await db.batch([
    db
      .prepare(
        `UPDATE routines
         SET state = 'archived', reminder_enabled = 0, updated_at = ?
         WHERE id = ?`,
      )
      .bind(new Date().toISOString(), id),
    db
      .prepare(
        "DELETE FROM reminders WHERE entity_type = 'routine' AND entity_id = ?",
      )
      .bind(id),
  ]);
  return getRoutine(id);
}

export async function listRoutineOccurrences(
  rangeStart: string,
  rangeEnd: string,
  timeZone: string,
  now = new Date(),
) {
  const routines = await listRoutines();
  const stored = await commandDatabase()
    .prepare(
      `SELECT * FROM routine_occurrences
       WHERE scheduled_date BETWEEN ? AND ?
       ORDER BY scheduled_date ASC
       LIMIT 2000`,
    )
    .bind(rangeStart, rangeEnd)
    .all<RoutineOccurrenceRow>();
  const storedMap = new Map(
    stored.results.map((row) => [
      `${row.routine_id}:${row.scheduled_date}`,
      row,
    ]),
  );
  const occurrences = new Map<string, RoutineOccurrence>();

  for (const routine of routines) {
    if (routine.state !== "active") continue;
    const rule = {
      ...routine.schedule,
      until:
        routine.endDate &&
        (!routine.schedule.until || routine.endDate < routine.schedule.until)
          ? routine.endDate
          : routine.schedule.until,
    };
    const dates = expandRecurrence(
      routine.startDate,
      rangeStart,
      rangeEnd,
      rule,
    );
    for (const scheduledDate of dates) {
      const storedOccurrence = storedMap.get(`${routine.id}:${scheduledDate}`);
      const scheduledAt = routine.preferredTime
        ? zonedDateTimeToUtc(scheduledDate, routine.preferredTime, timeZone)
        : null;
      const occurrence: RoutineOccurrence = {
        id: storedOccurrence?.id ?? `occurrence-${routine.id}-${scheduledDate}`,
        routineId: routine.id,
        routineName: routine.name,
        scheduledDate,
        scheduledAt,
        windowStartAt: routine.windowStart
          ? zonedDateTimeToUtc(scheduledDate, routine.windowStart, timeZone)
          : null,
        windowEndAt: routine.windowEnd
          ? zonedDateTimeToUtc(scheduledDate, routine.windowEnd, timeZone)
          : null,
        status:
          storedOccurrence?.status ??
          routineOccurrenceStatus(
            scheduledDate,
            routine.windowStart,
            routine.windowEnd,
            timeZone,
            now,
          ),
        completedAt: storedOccurrence?.completed_at ?? null,
        note: storedOccurrence?.note ?? "",
        source: "local",
        updatedAt: storedOccurrence?.updated_at ?? routine.updatedAt,
      };
      occurrences.set(`${routine.id}:${scheduledDate}`, occurrence);
    }
  }

  for (const row of stored.results) {
    const key = `${row.routine_id}:${row.scheduled_date}`;
    if (occurrences.has(key)) continue;
    const routine = routines.find((item) => item.id === row.routine_id);
    if (!routine) continue;
    occurrences.set(key, {
      id: row.id,
      routineId: routine.id,
      routineName: routine.name,
      scheduledDate: row.scheduled_date,
      scheduledAt: routine.preferredTime
        ? zonedDateTimeToUtc(
            row.scheduled_date,
            routine.preferredTime,
            timeZone,
          )
        : null,
      windowStartAt: null,
      windowEndAt: null,
      status: row.status,
      completedAt: row.completed_at,
      note: row.note,
      source: "local",
      updatedAt: row.updated_at,
    });
  }
  return [...occurrences.values()].sort((a, b) => {
    if (a.scheduledDate !== b.scheduledDate)
      return a.scheduledDate.localeCompare(b.scheduledDate);
    return (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "");
  });
}

export async function updateRoutineOccurrence(
  routineId: string,
  scheduledDate: string,
  status: "upcoming" | "due" | "completed" | "skipped",
  note: string,
) {
  const routine = await getRoutine(routineId);
  if (!routine) return null;
  const now = new Date().toISOString();
  const existing = await commandDatabase()
    .prepare(
      `SELECT id FROM routine_occurrences
       WHERE routine_id = ? AND scheduled_date = ?`,
    )
    .bind(routineId, scheduledDate)
    .first<{ id: string }>();
  if (existing) {
    await commandDatabase()
      .prepare(
        `UPDATE routine_occurrences
         SET status = ?, completed_at = ?, note = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(status, status === "completed" ? now : null, note, now, existing.id)
      .run();
  } else {
    await commandDatabase()
      .prepare(
        `INSERT INTO routine_occurrences
         (id, routine_id, scheduled_date, status, completed_at, note, source,
          updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'local', ?)`,
      )
      .bind(
        crypto.randomUUID(),
        routineId,
        scheduledDate,
        status,
        status === "completed" ? now : null,
        note,
        now,
      )
      .run();
  }
  const preferences = await getTimePreferences();
  return (
    await listRoutineOccurrences(
      scheduledDate,
      scheduledDate,
      preferences.timeZone,
    )
  ).find((item) => item.routineId === routineId);
}

function includesQuery(value: string | undefined | null, query: string) {
  return Boolean(value?.toLocaleLowerCase().includes(query));
}

export async function listCalendarPayload(
  rangeStart: string,
  rangeEnd: string,
  filters: CalendarFilters,
  displayTimeZone?: string,
): Promise<CalendarPayload> {
  await ensureTimeSchema();
  const storedPreferences = await getTimePreferences();
  const preferences = displayTimeZone
    ? { ...storedPreferences, timeZone: displayTimeZone }
    : storedPreferences;
  const [allEvents, allPriorities, allRoutines, allOccurrences, reminders] =
    await Promise.all([
      listCalendarEvents(rangeStart, rangeEnd),
      listPriorities(),
      listRoutines(),
      listRoutineOccurrences(rangeStart, rangeEnd, preferences.timeZone),
      listReminderRows(),
    ]);
  const query = filters.query.trim().toLocaleLowerCase();
  const events = filters.includeEvents
    ? allEvents.filter(
        (event) =>
          (!query ||
            includesQuery(event.title, query) ||
            includesQuery(event.notes, query)) &&
          (filters.includeCompleted || event.status !== "canceled"),
      )
    : [];
  const priorities = filters.includePriorities
    ? allPriorities.filter(
        (priority) =>
          (!query ||
            includesQuery(priority.title, query) ||
            includesQuery(priority.notes, query)) &&
          (filters.includeCompleted || priority.status !== "completed"),
      )
    : [];
  const routines = filters.includeRoutines
    ? allRoutines.filter(
        (routine) =>
          !query ||
          includesQuery(routine.name, query) ||
          includesQuery(routine.description, query),
      )
    : [];
  const routineIds = new Set(routines.map((routine) => routine.id));
  const occurrences = filters.includeRoutines
    ? allOccurrences.filter(
        (occurrence) =>
          routineIds.has(occurrence.routineId) &&
          (filters.includeCompleted ||
            !["completed", "skipped"].includes(occurrence.status)),
      )
    : [];
  return {
    rangeStart,
    rangeEnd,
    events,
    priorities,
    routines,
    occurrences,
    reminders,
    preferences,
    sourceLabel: "Private local workspace",
    lastUpdatedAt: new Date().toISOString(),
    stale: false,
    syncAvailable: false,
  };
}

export async function listCommandTimeline(
  localDate: string,
  timeZone: string,
): Promise<TimelineItem[]> {
  const [events, occurrences] = await Promise.all([
    listCalendarEvents(localDate, localDate),
    listRoutineOccurrences(localDate, localDate, timeZone),
  ]);
  const eventItems: TimelineItem[] = events.map((event) => ({
    id: event.occurrenceKey,
    title: event.title,
    kind: event.allDay ? "all-day" : "event",
    status: event.status === "canceled" ? "skipped" : "scheduled",
    startAt: event.startAt,
    endAt: event.endAt,
    localDate: event.localDate,
    timeZone: event.timeZone,
    notes: event.notes,
    source: event.source,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    location: event.location,
    category: event.category,
    isRecurring: Boolean(event.seriesId),
    seriesId: event.seriesId,
    occurrenceDate: event.occurrenceDate,
    occurrenceKey: event.occurrenceKey,
    conflictState: event.conflictState,
  }));
  const routineItems: TimelineItem[] = occurrences.map((occurrence) => ({
    id: `routine:${occurrence.routineId}:${occurrence.scheduledDate}`,
    title: occurrence.routineName,
    kind: "routine",
    status:
      occurrence.status === "completed"
        ? "completed"
        : occurrence.status === "skipped"
          ? "skipped"
          : "scheduled",
    startAt: occurrence.scheduledAt,
    endAt: occurrence.windowEndAt,
    localDate: occurrence.scheduledDate,
    timeZone,
    notes: occurrence.note,
    source: occurrence.source,
    createdAt: occurrence.updatedAt,
    updatedAt: occurrence.updatedAt,
    routineId: occurrence.routineId,
    occurrenceDate: occurrence.scheduledDate,
    occurrenceKey: `routine:${occurrence.routineId}:${occurrence.scheduledDate}`,
  }));
  return [...eventItems, ...routineItems].sort((a, b) => {
    if (a.kind === "all-day" && b.kind !== "all-day") return -1;
    if (b.kind === "all-day" && a.kind !== "all-day") return 1;
    return (a.startAt ?? "").localeCompare(b.startAt ?? "");
  });
}

export async function listTimePriorities(): Promise<Priority[]> {
  return listPriorities();
}
