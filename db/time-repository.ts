import type { Priority, TimelineItem } from "../lib/domain/types";
import {
  addDays,
  daysBetween,
  expandRecurrence,
  isInQuietHours,
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
  ReminderInstance,
  ReminderState,
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

type ReminderInstanceRow = {
  id: string;
  reminder_id: string;
  event_id: string;
  occurrence_date: string;
  occurrence_key: string;
  scheduled_for: string;
  delivered_at: string | null;
  seen_at: string | null;
  snoozed_until: string | null;
  resolved_at: string | null;
  state: ReminderState;
  reason: string;
  rule_label: string;
  escalation_level: number;
  next_escalation_at: string | null;
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
  default_view: TimePreferences["defaultView"];
  default_event_duration_minutes: number;
  transition_buffer_minutes: number;
  morning_brief_time: string;
  evening_brief_time: string;
  escalation_enabled: number;
  default_snooze_minutes: number;
  overload_minutes_per_day: number;
  overload_important_item_count: number;
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

function reminderInstanceFromRow(row: ReminderInstanceRow): ReminderInstance {
  return {
    id: row.id,
    reminderId: row.reminder_id,
    eventId: row.event_id,
    occurrenceDate: row.occurrence_date,
    occurrenceKey: row.occurrence_key,
    scheduledFor: row.scheduled_for,
    deliveredAt: row.delivered_at,
    seenAt: row.seen_at,
    snoozedUntil: row.snoozed_until,
    resolvedAt: row.resolved_at,
    state: row.state,
    reason: row.reason,
    ruleLabel: row.rule_label,
    escalationLevel: row.escalation_level,
    nextEscalationAt: row.next_escalation_at,
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
    defaultView: row.default_view,
    defaultEventDurationMinutes: row.default_event_duration_minutes,
    transitionBufferMinutes: row.transition_buffer_minutes,
    morningBriefTime: row.morning_brief_time,
    eveningBriefTime: row.evening_brief_time,
    escalationEnabled: Boolean(row.escalation_enabled),
    defaultSnoozeMinutes: row.default_snooze_minutes,
    overloadMinutesPerDay: row.overload_minutes_per_day,
    overloadImportantItemCount: row.overload_important_item_count,
    updatedAt: row.updated_at,
  };
}

function eventInputFromRow(row: TimelineRow): CalendarEventInput {
  const metadata = parseJson<
    Pick<
      CalendarEventInput,
      | "eventType"
      | "provider"
      | "meetingUrl"
      | "amount"
      | "currency"
      | "paymentStatus"
      | "priority"
      | "status"
      | "relationship"
      | "birthYear"
      | "giftIdea"
      | "contactMethod"
      | "billCategory"
      | "autopay"
      | "accountNote"
      | "paidAt"
      | "escalationEnabled"
      | "sensitive"
    >
  >(row.event_metadata, {
    eventType: "personal",
    provider: "",
    meetingUrl: "",
    amount: null,
    currency: "USD",
    paymentStatus: null,
    priority: "standard",
    status: row.event_status === "canceled" ? "cancelled" : "scheduled",
    relationship: "",
    birthYear: null,
    giftIdea: "",
    contactMethod: "",
    billCategory: "",
    autopay: false,
    accountNote: "",
    paidAt: null,
    escalationEnabled: true,
    sensitive: false,
  });
  return {
    title: row.title,
    ...metadata,
    notes: row.notes,
    location: row.location,
    eventType:
      metadata.eventType === "personal" && row.category
        ? [
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
          ].includes(row.category)
          ? (row.category as CalendarEventInput["eventType"])
          : "custom"
        : metadata.eventType,
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
           notification_permission = ?, default_view = ?,
           default_event_duration_minutes = ?, transition_buffer_minutes = ?,
           morning_brief_time = ?, evening_brief_time = ?,
           escalation_enabled = ?, default_snooze_minutes = ?,
           overload_minutes_per_day = ?,
           overload_important_item_count = ?, updated_at = ?
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
      input.defaultView,
      input.defaultEventDurationMinutes,
      input.transitionBufferMinutes,
      input.morningBriefTime,
      input.eveningBriefTime,
      input.escalationEnabled ? 1 : 0,
      input.defaultSnoozeMinutes,
      input.overloadMinutesPerDay,
      input.overloadImportantItemCount,
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
  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare("DELETE FROM reminders WHERE entity_type = ? AND entity_id = ?")
      .bind(entityType, entityId),
    ...offsets.map((offset) =>
      db
        .prepare(
          `INSERT OR REPLACE INTO reminders
           (id, entity_type, entity_id, offset_minutes, channel, enabled,
            quiet_behavior, delivery_status, delivered_at, created_at,
            updated_at)
           VALUES (?, ?, ?, ?, 'in-app', 1, 'delay', 'pending', NULL, ?, ?)`,
        )
        .bind(
          `reminder:${entityType}:${entityId}:${offset}:in-app`,
          entityType,
          entityId,
          offset,
          now,
          now,
        ),
    ),
  ]);
  await db
    .prepare(
      `UPDATE reminder_instances
       SET state = 'expired', resolved_at = ?, updated_at = ?
       WHERE event_id = ?
         AND state IN ('scheduled', 'delivered', 'seen', 'snoozed')
         AND NOT EXISTS (
           SELECT 1 FROM reminders
           WHERE reminders.id = reminder_instances.reminder_id
         )`,
    )
    .bind(now, now, entityId)
    .run();
}

function reminderReason(event: CalendarEvent, offset: number) {
  if (event.eventType === "financial")
    return event.paymentStatus === "unpaid"
      ? "Bill payment is still unresolved."
      : "Bill due-date reminder.";
  if (event.eventType === "birthday") return "Birthday planning reminder.";
  if (event.eventType === "medical") return "Medical appointment reminder.";
  if (offset === 0) return "Scheduled event is due.";
  return "User-configured event reminder.";
}

function reminderRuleLabel(event: CalendarEvent, offset: number) {
  const timing =
    offset === 0
      ? "At event time"
      : offset % 1_440 === 0
        ? `${offset / 1_440} day${offset === 1_440 ? "" : "s"} before`
        : offset % 60 === 0
          ? `${offset / 60} hour${offset === 60 ? "" : "s"} before`
          : `${offset} minutes before`;
  return `${event.eventType} preset · ${timing}`;
}

async function reconcileReminderInstances(
  events: CalendarEvent[],
  definitions: Reminder[],
  preferences: TimePreferences,
  now = new Date(),
) {
  const db = commandDatabase();
  const timestamp = now.toISOString();
  const eventDefinitions = new Map<string, Reminder[]>();
  for (const definition of definitions) {
    if (definition.entityType !== "event" || !definition.enabled) continue;
    eventDefinitions.set(definition.entityId, [
      ...(eventDefinitions.get(definition.entityId) ?? []),
      definition,
    ]);
  }
  const statements = events.flatMap((event) => {
    const anchor = event.startAt
      ? event.startAt
      : event.allDay
        ? zonedDateTimeToUtc(event.localDate, "09:00", event.timeZone)
        : null;
    if (!anchor) return [];
    return (eventDefinitions.get(event.id) ?? []).map((definition) => {
      const scheduledFor = new Date(
        Date.parse(anchor) - definition.offsetMinutes * 60_000,
      ).toISOString();
      const id = `reminder-instance:${definition.id}:${event.occurrenceKey}`;
      return db
        .prepare(
          `INSERT INTO reminder_instances
           (id, reminder_id, event_id, occurrence_date, occurrence_key,
            scheduled_for, delivered_at, seen_at, snoozed_until, resolved_at,
            state, reason, rule_label, escalation_level, next_escalation_at,
            created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, 'scheduled',
            ?, ?, 0, NULL, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             scheduled_for = excluded.scheduled_for,
             reason = excluded.reason,
             rule_label = excluded.rule_label,
             updated_at = excluded.updated_at`,
        )
        .bind(
          id,
          definition.id,
          event.id,
          event.occurrenceDate,
          event.occurrenceKey,
          scheduledFor,
          reminderReason(event, definition.offsetMinutes),
          reminderRuleLabel(event, definition.offsetMinutes),
          timestamp,
          timestamp,
        );
    });
  });
  if (statements.length) await db.batch(statements);

  for (const event of events) {
    const resolved =
      ["completed", "dismissed", "cancelled"].includes(event.status) ||
      event.paymentStatus === "paid";
    if (!resolved) continue;
    await db
      .prepare(
        `UPDATE reminder_instances
         SET state = 'resolved', resolved_at = ?, next_escalation_at = NULL,
             updated_at = ?
         WHERE occurrence_key = ?
           AND state NOT IN ('resolved', 'dismissed', 'expired')`,
      )
      .bind(timestamp, timestamp, event.occurrenceKey)
      .run();
  }

  const pending = await db
    .prepare(
      `SELECT * FROM reminder_instances
       WHERE state IN ('scheduled', 'delivered', 'seen', 'snoozed')
       ORDER BY scheduled_for ASC LIMIT 1000`,
    )
    .all<ReminderInstanceRow>();
  const eventMap = new Map(events.map((event) => [event.occurrenceKey, event]));
  const quiet = isInQuietHours(
    localTimeInZone(now, preferences.timeZone),
    preferences,
  );
  for (const row of pending.results) {
    const event = eventMap.get(row.occurrence_key);
    if (!event) continue;
    const dueAt =
      row.state === "snoozed" && row.snoozed_until
        ? row.snoozed_until
        : row.scheduled_for;
    if (Date.parse(dueAt) > now.getTime()) continue;
    if (quiet && preferences.quietBehavior === "suppress") {
      await db
        .prepare(
          `UPDATE reminder_instances
           SET state = 'expired', resolved_at = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(timestamp, timestamp, row.id)
        .run();
      continue;
    }
    if (quiet && preferences.quietBehavior === "delay") continue;
    if (row.state === "scheduled" || row.state === "snoozed") {
      const cap = event.priority === "critical" ? 3 : 1;
      const nextEscalationAt =
        preferences.escalationEnabled &&
        event.escalationEnabled !== false &&
        event.priority !== "standard"
          ? new Date(
              now.getTime() +
                (event.priority === "critical" ? 30 : 60) * 60_000,
            ).toISOString()
          : null;
      await db
        .prepare(
          `UPDATE reminder_instances
           SET state = 'delivered', delivered_at = COALESCE(delivered_at, ?),
               snoozed_until = NULL, next_escalation_at = ?,
               escalation_level = MIN(escalation_level, ?), updated_at = ?
           WHERE id = ?`,
        )
        .bind(timestamp, nextEscalationAt, cap, timestamp, row.id)
        .run();
      continue;
    }
    const cap = event.priority === "critical" ? 3 : 1;
    if (
      preferences.escalationEnabled &&
      event.escalationEnabled !== false &&
      event.priority !== "standard" &&
      row.next_escalation_at &&
      Date.parse(row.next_escalation_at) <= now.getTime() &&
      row.escalation_level < cap
    ) {
      await db
        .prepare(
          `UPDATE reminder_instances
           SET escalation_level = escalation_level + 1,
               next_escalation_at = CASE
                 WHEN escalation_level + 1 >= ? THEN NULL ELSE ?
               END,
               state = 'delivered', updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          cap,
          new Date(
            now.getTime() + (event.priority === "critical" ? 30 : 60) * 60_000,
          ).toISOString(),
          timestamp,
          row.id,
        )
        .run();
    }
  }
}

async function listReminderInstances() {
  const result = await commandDatabase()
    .prepare(
      `SELECT * FROM reminder_instances
       ORDER BY COALESCE(snoozed_until, scheduled_for) ASC
       LIMIT 1000`,
    )
    .all<ReminderInstanceRow>();
  return result.results.map(reminderInstanceFromRow);
}

export async function updateReminderInstance(
  id: string,
  action: "seen" | "snooze" | "resolve" | "dismiss",
  snoozedUntil?: string | null,
) {
  await ensureTimeSchema();
  const now = new Date().toISOString();
  const current = await commandDatabase()
    .prepare("SELECT * FROM reminder_instances WHERE id = ?")
    .bind(id)
    .first<ReminderInstanceRow>();
  if (!current) return null;
  const nextState: ReminderState =
    action === "seen"
      ? "seen"
      : action === "snooze"
        ? "snoozed"
        : action === "dismiss"
          ? "dismissed"
          : "resolved";
  await commandDatabase()
    .prepare(
      `UPDATE reminder_instances
       SET state = ?, seen_at = CASE WHEN ? = 'seen' THEN ? ELSE seen_at END,
           snoozed_until = CASE WHEN ? = 'snoozed' THEN ? ELSE NULL END,
           resolved_at = CASE
             WHEN ? IN ('resolved', 'dismissed') THEN ? ELSE NULL
           END,
           next_escalation_at = CASE
             WHEN ? IN ('resolved', 'dismissed', 'snoozed') THEN NULL
             ELSE next_escalation_at
           END,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      nextState,
      nextState,
      now,
      nextState,
      snoozedUntil ?? null,
      nextState,
      now,
      nextState,
      now,
      id,
    )
    .run();
  const updated = await commandDatabase()
    .prepare("SELECT * FROM reminder_instances WHERE id = ?")
    .bind(id)
    .first<ReminderInstanceRow>();
  return updated ? reminderInstanceFromRow(updated) : null;
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

function eventMetadata(input: CalendarEventInput) {
  return JSON.stringify({
    eventType: input.eventType,
    provider: input.provider,
    meetingUrl: input.meetingUrl,
    amount: input.amount,
    currency: input.currency,
    paymentStatus: input.paymentStatus,
    priority: input.priority,
    status: input.status,
    relationship: input.relationship ?? "",
    birthYear: input.birthYear ?? null,
    giftIdea: input.giftIdea ?? "",
    contactMethod: input.contactMethod ?? "",
    billCategory: input.billCategory ?? "",
    autopay: input.autopay ?? false,
    accountNote: input.accountNote ?? "",
    paidAt: input.paidAt ?? null,
    escalationEnabled: input.escalationEnabled ?? true,
    sensitive: input.sensitive ?? false,
  });
}

export async function upsertImportedCalendarEvent(input: {
  id: string;
  event: CalendarEventInput;
  sourceId: string;
  externalCalendarId: string;
  remoteVersion: string | null;
  readOnly: boolean;
  syncedAt: string;
}) {
  await ensureTimeSchema();
  const startAt =
    input.event.allDay || !input.event.startTime
      ? null
      : zonedDateTimeToUtc(
          input.event.localDate,
          input.event.startTime,
          input.event.timeZone,
        );
  const endAt =
    input.event.allDay || !input.event.endTime
      ? null
      : zonedDateTimeToUtc(
          input.event.endLocalDate,
          input.event.endTime,
          input.event.timeZone,
        );
  const now = new Date().toISOString();
  await commandDatabase()
    .prepare(
      `INSERT INTO timeline_items
       (id, title, kind, status, start_at, end_at, local_date, end_local_date,
        start_time, end_time, time_zone, notes, location, category,
        event_status, event_metadata, recurrence_rule, source, source_id,
        external_calendar_id, last_synced_at, local_version, remote_version,
        read_only, conflict_state, deleted_at, migrated_to_routine_id,
        created_at, updated_at)
       VALUES (?, ?, ?, 'scheduled', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL,
        'imported', ?, ?, ?, 1, ?, ?, 'none', NULL, NULL, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         kind = excluded.kind,
         start_at = excluded.start_at,
         end_at = excluded.end_at,
         local_date = excluded.local_date,
         end_local_date = excluded.end_local_date,
         start_time = excluded.start_time,
         end_time = excluded.end_time,
         time_zone = excluded.time_zone,
         notes = excluded.notes,
         location = excluded.location,
         category = excluded.category,
         event_status = excluded.event_status,
         event_metadata = excluded.event_metadata,
         source = 'imported',
         source_id = excluded.source_id,
         external_calendar_id = excluded.external_calendar_id,
         last_synced_at = excluded.last_synced_at,
         remote_version = excluded.remote_version,
         read_only = excluded.read_only,
         conflict_state = 'none',
         deleted_at = NULL,
         updated_at = excluded.updated_at`,
    )
    .bind(
      input.id,
      input.event.title,
      input.event.allDay ? "all-day" : "event",
      startAt,
      endAt,
      input.event.localDate,
      input.event.endLocalDate,
      input.event.startTime,
      input.event.endTime,
      input.event.timeZone,
      input.event.notes,
      input.event.location,
      input.event.eventType,
      input.event.status === "cancelled" ? "canceled" : "confirmed",
      eventMetadata(input.event),
      input.sourceId,
      input.externalCalendarId,
      input.syncedAt,
      input.remoteVersion,
      input.readOnly ? 1 : 0,
      now,
      now,
    )
    .run();
  return input.id;
}

export async function markImportedCalendarEventDeleted(
  id: string,
  syncedAt: string,
) {
  await ensureTimeSchema();
  await commandDatabase()
    .prepare(
      `UPDATE timeline_items
       SET deleted_at = ?, last_synced_at = ?, updated_at = ?
       WHERE id = ? AND source = 'imported'`,
    )
    .bind(syncedAt, syncedAt, syncedAt, id)
    .run();
}

export async function setCalendarEventConflictState(
  id: string,
  state: CalendarEvent["conflictState"],
) {
  await ensureTimeSchema();
  await commandDatabase()
    .prepare(
      `UPDATE timeline_items
       SET conflict_state = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(state, new Date().toISOString(), id)
    .run();
}

export async function getCanonicalCalendarEvent(id: string) {
  const row = await getEventRow(id);
  if (!row) return null;
  return {
    input: eventInputFromRow(row),
    source: row.source,
    sourceId: row.source_id,
    externalCalendarId: row.external_calendar_id,
    localVersion: row.local_version,
    remoteVersion: row.remote_version,
    readOnly: Boolean(row.read_only),
  };
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
      `INSERT OR IGNORE INTO timeline_items
       (id, title, kind, status, start_at, end_at, local_date, end_local_date,
        start_time, end_time, time_zone, notes, location, category,
        event_status, event_metadata, recurrence_rule, source, source_id,
        external_calendar_id, last_synced_at, local_version, remote_version,
        read_only, conflict_state, deleted_at, migrated_to_routine_id,
        created_at, updated_at)
       VALUES (?, ?, ?, 'scheduled', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
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
      input.eventType,
      input.status === "cancelled" ? "canceled" : "confirmed",
      eventMetadata(input),
      input.recurrence ? JSON.stringify(input.recurrence) : null,
      createdAt,
      now,
    )
    .run();
  await replaceReminders("event", id, input.reminderOffsets);
  return id;
}

export async function createCalendarEvent(
  input: CalendarEventInput,
  id = crypto.randomUUID(),
) {
  await ensureTimeSchema();
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
           event_metadata = ?, recurrence_rule = ?,
           local_version = local_version + 1,
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
      input.eventType,
      input.status === "cancelled" ? "canceled" : "confirmed",
      eventMetadata(input),
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
      db
        .prepare(
          `UPDATE reminder_instances
           SET state = 'expired', resolved_at = ?, updated_at = ?
           WHERE event_id = ?
             AND state IN ('scheduled', 'delivered', 'seen', 'snoozed')`,
        )
        .bind(now, now, id),
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
  if (
    input.allDay ||
    input.status !== "scheduled" ||
    !input.startTime ||
    !input.endTime
  )
    return [];
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
      event.status !== "scheduled" ||
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

export async function createRoutine(
  input: RoutineInput,
  id = crypto.randomUUID(),
) {
  await ensureTimeSchema();
  const now = new Date().toISOString();
  await commandDatabase()
    .prepare(
      `INSERT OR IGNORE INTO routines
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
  await commandDatabase()
    .prepare(
      `INSERT INTO routine_occurrences
       (id, routine_id, scheduled_date, status, completed_at, note, source,
        updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'local', ?)
       ON CONFLICT(routine_id, scheduled_date) DO UPDATE SET
         status = excluded.status,
         completed_at = excluded.completed_at,
         note = excluded.note,
         updated_at = excluded.updated_at`,
    )
    .bind(
      `occurrence:${routineId}:${scheduledDate}`,
      routineId,
      scheduledDate,
      status,
      status === "completed" ? now : null,
      note,
      now,
    )
    .run();
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
  await reconcileReminderInstances(
    allEvents,
    reminders,
    preferences,
    new Date(),
  );
  const reminderInstances = await listReminderInstances();
  const query = filters.query.trim().toLocaleLowerCase();
  const events = filters.includeEvents
    ? allEvents.filter(
        (event) =>
          (!query ||
            includesQuery(event.title, query) ||
            includesQuery(event.notes, query) ||
            includesQuery(event.location, query) ||
            includesQuery(event.provider, query) ||
            includesQuery(event.meetingUrl, query) ||
            includesQuery(event.eventType, query) ||
            includesQuery(event.paymentStatus, query) ||
            includesQuery(event.status, query) ||
            includesQuery(event.relationship, query) ||
            includesQuery(event.billCategory, query) ||
            (event.amount !== null &&
              new Intl.NumberFormat(preferences.locale, {
                style: "currency",
                currency: event.currency,
              })
                .format(event.amount)
                .toLocaleLowerCase()
                .includes(query))) &&
          (!filters.eventTypes.length ||
            filters.eventTypes.includes(event.eventType)) &&
          (!filters.statuses.length ||
            filters.statuses.includes(event.status)) &&
          (!filters.priorities.length ||
            filters.priorities.includes(event.priority)) &&
          (filters.payment === "all" ||
            event.paymentStatus === filters.payment) &&
          (filters.recurrence === "all" ||
            (filters.recurrence === "recurring"
              ? Boolean(event.recurrence)
              : !event.recurrence)) &&
          (filters.includeCompleted ||
            filters.statuses.includes(event.status) ||
            !["completed", "dismissed", "cancelled"].includes(event.status)),
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
    reminderInstances,
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
    status:
      event.status === "completed"
        ? "completed"
        : event.status === "dismissed" || event.status === "cancelled"
          ? "skipped"
          : "scheduled",
    startAt: event.startAt,
    endAt: event.endAt,
    localDate: event.localDate,
    timeZone: event.timeZone,
    notes: event.notes,
    source: event.source,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    location: event.location,
    category: event.eventType,
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
