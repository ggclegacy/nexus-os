import type {
  Priority,
  PriorityInput,
  PriorityUpdate,
  TimelineInput,
  TimelineItem,
  TimelineUpdate,
} from "../lib/domain/types";
import { ConflictError } from "../lib/domain/errors";
import { ValidationError } from "../lib/domain/validation";
import { localDateInZone, localTimeInZone } from "../lib/time/rules";
import { database } from "./database";
import type { NexusDatabase } from "./database-contract";

type PriorityRow = {
  id: string;
  title: string;
  notes: string;
  due_at: string | null;
  status: "active" | "completed";
  position: number;
  is_top: number;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  archived_at: string | null;
  reminder_enabled: number;
  reminder_offset_minutes: number | null;
  source: "local";
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type TimelineRow = {
  id: string;
  title: string;
  kind: "event" | "all-day" | "routine";
  status: "scheduled" | "completed" | "skipped";
  start_at: string | null;
  end_at: string | null;
  local_date: string;
  end_local_date: string | null;
  start_time: string | null;
  end_time: string | null;
  time_zone: string;
  notes: string;
  location: string;
  category: string | null;
  event_status: "confirmed" | "tentative" | "canceled";
  event_metadata: string;
  recurrence_rule: string | null;
  source: "local" | "imported";
  source_id: string | null;
  external_calendar_id: string | null;
  last_synced_at: string | null;
  local_version: number;
  remote_version: string | null;
  read_only: number;
  conflict_state: "none" | "local-newer" | "remote-newer";
  deleted_at: string | null;
  migrated_to_routine_id: string | null;
  created_at: string;
  updated_at: string;
};

export function commandDatabase() {
  return database();
}

let initialization: Promise<void> | null = null;

async function ensureColumns(
  db: NexusDatabase,
  table: "priorities" | "timeline_items" | "time_preferences",
  columns: Record<string, string>,
) {
  const current = await db
    .prepare(`PRAGMA table_info(${table})`)
    .all<{ name: string }>();
  const names = new Set(current.results.map((column) => column.name));
  for (const [name, definition] of Object.entries(columns)) {
    if (names.has(name)) continue;
    await db
      .prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`)
      .run();
  }
}

export function ensureCommandSchema() {
  if (initialization) return initialization;
  const db = commandDatabase();
  initialization = (async () => {
    await db.batch([
      db.prepare(`
        CREATE TABLE IF NOT EXISTS priorities (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          notes TEXT NOT NULL DEFAULT '',
          due_at TEXT,
          status TEXT NOT NULL DEFAULT 'active'
            CHECK (status IN ('active', 'completed')),
          position INTEGER NOT NULL DEFAULT 0,
          is_top INTEGER NOT NULL DEFAULT 1,
          scheduled_start_at TEXT,
          scheduled_end_at TEXT,
          archived_at TEXT,
          reminder_enabled INTEGER NOT NULL DEFAULT 0,
          reminder_offset_minutes INTEGER,
          source TEXT NOT NULL DEFAULT 'local',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS timeline_items (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          kind TEXT NOT NULL
            CHECK (kind IN ('event', 'all-day', 'routine')),
          status TEXT NOT NULL DEFAULT 'scheduled'
            CHECK (status IN ('scheduled', 'completed', 'skipped')),
          start_at TEXT,
          end_at TEXT,
          local_date TEXT NOT NULL,
          end_local_date TEXT,
          start_time TEXT,
          end_time TEXT,
          time_zone TEXT NOT NULL,
          notes TEXT NOT NULL DEFAULT '',
          location TEXT NOT NULL DEFAULT '',
          category TEXT,
          event_status TEXT NOT NULL DEFAULT 'confirmed',
          recurrence_rule TEXT,
          source TEXT NOT NULL DEFAULT 'local',
          source_id TEXT,
          external_calendar_id TEXT,
          last_synced_at TEXT,
          local_version INTEGER NOT NULL DEFAULT 1,
          remote_version TEXT,
          read_only INTEGER NOT NULL DEFAULT 0,
          conflict_state TEXT NOT NULL DEFAULT 'none',
          deleted_at TEXT,
          migrated_to_routine_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS quick_captures (
          id TEXT PRIMARY KEY NOT NULL,
          content TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'local',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS event_exceptions (
          id TEXT PRIMARY KEY NOT NULL,
          series_id TEXT NOT NULL,
          original_date TEXT NOT NULL,
          kind TEXT NOT NULL
            CHECK (kind IN ('edited', 'canceled', 'additional')),
          override_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS routines (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          recurrence_rule TEXT NOT NULL,
          preferred_time TEXT,
          window_start TEXT,
          window_end TEXT,
          expected_minutes INTEGER,
          start_date TEXT NOT NULL,
          end_date TEXT,
          state TEXT NOT NULL DEFAULT 'active'
            CHECK (state IN ('active', 'paused', 'archived')),
          reminder_enabled INTEGER NOT NULL DEFAULT 0,
          reminder_offset_minutes INTEGER,
          source TEXT NOT NULL DEFAULT 'local',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS routine_occurrences (
          id TEXT PRIMARY KEY NOT NULL,
          routine_id TEXT NOT NULL,
          scheduled_date TEXT NOT NULL,
          status TEXT NOT NULL
            CHECK (status IN ('upcoming', 'due', 'completed', 'skipped')),
          completed_at TEXT,
          note TEXT NOT NULL DEFAULT '',
          source TEXT NOT NULL DEFAULT 'local',
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS reminders (
          id TEXT PRIMARY KEY NOT NULL,
          entity_type TEXT NOT NULL
            CHECK (entity_type IN ('event', 'priority', 'routine')),
          entity_id TEXT NOT NULL,
          offset_minutes INTEGER NOT NULL,
          channel TEXT NOT NULL DEFAULT 'in-app',
          enabled INTEGER NOT NULL DEFAULT 1,
          quiet_behavior TEXT NOT NULL DEFAULT 'delay',
          delivery_status TEXT NOT NULL DEFAULT 'pending',
          delivered_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS reminder_instances (
          id TEXT PRIMARY KEY NOT NULL,
          reminder_id TEXT NOT NULL,
          event_id TEXT NOT NULL,
          occurrence_date TEXT NOT NULL,
          occurrence_key TEXT NOT NULL,
          scheduled_for TEXT NOT NULL,
          delivered_at TEXT,
          seen_at TEXT,
          snoozed_until TEXT,
          resolved_at TEXT,
          state TEXT NOT NULL DEFAULT 'scheduled'
            CHECK (state IN (
              'scheduled', 'delivered', 'seen', 'snoozed',
              'resolved', 'dismissed', 'expired'
            )),
          reason TEXT NOT NULL,
          rule_label TEXT NOT NULL,
          escalation_level INTEGER NOT NULL DEFAULT 0,
          next_escalation_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS time_preferences (
          id TEXT PRIMARY KEY NOT NULL DEFAULT 'default',
          time_zone TEXT NOT NULL DEFAULT 'UTC',
          locale TEXT NOT NULL DEFAULT 'en-US',
          week_starts_on INTEGER NOT NULL DEFAULT 1,
          hour_cycle TEXT NOT NULL DEFAULT '12',
          quiet_hours_enabled INTEGER NOT NULL DEFAULT 0,
          quiet_hours_start TEXT NOT NULL DEFAULT '22:00',
          quiet_hours_end TEXT NOT NULL DEFAULT '07:00',
          quiet_behavior TEXT NOT NULL DEFAULT 'delay',
          notification_permission TEXT NOT NULL DEFAULT 'in-app-only',
          default_view TEXT NOT NULL DEFAULT 'day',
          default_event_duration_minutes INTEGER NOT NULL DEFAULT 60,
          transition_buffer_minutes INTEGER NOT NULL DEFAULT 15,
          morning_brief_time TEXT NOT NULL DEFAULT '07:00',
          evening_brief_time TEXT NOT NULL DEFAULT '20:00',
          escalation_enabled INTEGER NOT NULL DEFAULT 1,
          default_snooze_minutes INTEGER NOT NULL DEFAULT 60,
          overload_minutes_per_day INTEGER NOT NULL DEFAULT 480,
          overload_important_item_count INTEGER NOT NULL DEFAULT 5,
          updated_at TEXT NOT NULL
        )
      `),
    ]);

    await ensureColumns(db, "priorities", {
      notes: "TEXT NOT NULL DEFAULT ''",
      is_top: "INTEGER NOT NULL DEFAULT 1",
      scheduled_start_at: "TEXT",
      scheduled_end_at: "TEXT",
      archived_at: "TEXT",
      reminder_enabled: "INTEGER NOT NULL DEFAULT 0",
      reminder_offset_minutes: "INTEGER",
    });
    await ensureColumns(db, "timeline_items", {
      end_local_date: "TEXT",
      start_time: "TEXT",
      end_time: "TEXT",
      location: "TEXT NOT NULL DEFAULT ''",
      category: "TEXT",
      event_status: "TEXT NOT NULL DEFAULT 'confirmed'",
      event_metadata: "TEXT NOT NULL DEFAULT '{}'",
      recurrence_rule: "TEXT",
      source_id: "TEXT",
      external_calendar_id: "TEXT",
      last_synced_at: "TEXT",
      local_version: "INTEGER NOT NULL DEFAULT 1",
      remote_version: "TEXT",
      read_only: "INTEGER NOT NULL DEFAULT 0",
      conflict_state: "TEXT NOT NULL DEFAULT 'none'",
      deleted_at: "TEXT",
      migrated_to_routine_id: "TEXT",
    });
    await ensureColumns(db, "time_preferences", {
      default_view: "TEXT NOT NULL DEFAULT 'day'",
      default_event_duration_minutes: "INTEGER NOT NULL DEFAULT 60",
      transition_buffer_minutes: "INTEGER NOT NULL DEFAULT 15",
      morning_brief_time: "TEXT NOT NULL DEFAULT '07:00'",
      evening_brief_time: "TEXT NOT NULL DEFAULT '20:00'",
      escalation_enabled: "INTEGER NOT NULL DEFAULT 1",
      default_snooze_minutes: "INTEGER NOT NULL DEFAULT 60",
      overload_minutes_per_day: "INTEGER NOT NULL DEFAULT 480",
      overload_important_item_count: "INTEGER NOT NULL DEFAULT 5",
    });

    await db.batch([
      db.prepare(`
        CREATE INDEX IF NOT EXISTS priorities_top_position_idx
        ON priorities (status, is_top, position)
      `),
      db.prepare(`
        CREATE INDEX IF NOT EXISTS priorities_due_at_idx
        ON priorities (due_at)
      `),
      db.prepare(`
        CREATE INDEX IF NOT EXISTS timeline_local_date_idx
        ON timeline_items (local_date, start_at)
      `),
      db.prepare(`
        CREATE INDEX IF NOT EXISTS timeline_recurrence_range_idx
        ON timeline_items (local_date, deleted_at)
      `),
      db.prepare(`
        CREATE UNIQUE INDEX IF NOT EXISTS event_exception_series_date_idx
        ON event_exceptions (series_id, original_date)
      `),
      db.prepare(`
        CREATE INDEX IF NOT EXISTS routines_state_start_idx
        ON routines (state, start_date)
      `),
      db.prepare(`
        CREATE UNIQUE INDEX IF NOT EXISTS routine_occurrence_date_idx
        ON routine_occurrences (routine_id, scheduled_date)
      `),
      db.prepare(`
        CREATE INDEX IF NOT EXISTS reminders_entity_idx
        ON reminders (entity_type, entity_id)
      `),
      db.prepare(`
        CREATE UNIQUE INDEX IF NOT EXISTS reminder_instance_occurrence_rule_idx
        ON reminder_instances (reminder_id, occurrence_key)
      `),
      db.prepare(`
        CREATE INDEX IF NOT EXISTS reminder_instance_state_due_idx
        ON reminder_instances (state, scheduled_for)
      `),
    ]);

    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT OR IGNORE INTO time_preferences
         (id, time_zone, locale, week_starts_on, hour_cycle,
          quiet_hours_enabled, quiet_hours_start, quiet_hours_end,
          quiet_behavior, notification_permission, updated_at)
         VALUES ('default', 'UTC', 'en-US', 1, '12', 0, '22:00', '07:00',
          'delay', 'in-app-only', ?)`,
      )
      .bind(now)
      .run();
  })().catch((error: unknown) => {
    initialization = null;
    throw error;
  });
  return initialization;
}

export function priorityFromRow(row: PriorityRow): Priority {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    dueAt: row.due_at,
    status: row.status,
    position: row.position,
    isTop: Boolean(row.is_top),
    scheduledStartAt: row.scheduled_start_at,
    scheduledEndAt: row.scheduled_end_at,
    archivedAt: row.archived_at,
    reminderEnabled: Boolean(row.reminder_enabled),
    reminderOffsetMinutes: row.reminder_offset_minutes,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export function timelineFromRow(row: TimelineRow): TimelineItem {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    status: row.status,
    startAt: row.start_at,
    endAt: row.end_at,
    localDate: row.local_date,
    timeZone: row.time_zone,
    notes: row.notes,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    location: row.location,
    category: row.category,
    isRecurring: Boolean(row.recurrence_rule),
    seriesId: row.recurrence_rule ? row.id : null,
    occurrenceDate: row.local_date,
    occurrenceKey: row.recurrence_rule
      ? `event:${row.id}:${row.local_date}`
      : row.id,
    conflictState: row.conflict_state,
  };
}

export async function listPriorities() {
  await ensureCommandSchema();
  const result = await commandDatabase()
    .prepare(
      `SELECT * FROM priorities
       WHERE archived_at IS NULL
       ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END,
                is_top DESC, position ASC, updated_at DESC
       LIMIT 500`,
    )
    .all<PriorityRow>();
  return result.results.map(priorityFromRow);
}

export async function getPriority(id: string) {
  await ensureCommandSchema();
  const row = await commandDatabase()
    .prepare("SELECT * FROM priorities WHERE id = ?")
    .bind(id)
    .first<PriorityRow>();
  return row ? priorityFromRow(row) : null;
}

export async function createPriority(
  input: PriorityInput,
  id = crypto.randomUUID(),
) {
  await ensureCommandSchema();
  const db = commandDatabase();
  const isTop = input.isTop ?? true;
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT OR IGNORE INTO priorities
       (id, title, notes, due_at, status, position, is_top,
        scheduled_start_at, scheduled_end_at, reminder_enabled,
        reminder_offset_minutes, source, created_at, updated_at)
       SELECT ?, ?, ?, ?, 'active',
              CASE WHEN ? = 1 THEN COALESCE((
                SELECT MAX(position) + 1 FROM priorities
                WHERE status = 'active' AND is_top = 1
                  AND archived_at IS NULL
              ), 0) ELSE 0 END,
              ?, ?, ?, ?, ?, 'local', ?, ?
       WHERE ? = 0 OR (
         SELECT COUNT(*) FROM priorities
         WHERE status = 'active' AND is_top = 1 AND archived_at IS NULL
       ) < 3`,
    )
    .bind(
      id,
      input.title,
      input.notes ?? "",
      input.dueAt ?? null,
      isTop ? 1 : 0,
      isTop ? 1 : 0,
      input.scheduledStartAt ?? null,
      input.scheduledEndAt ?? null,
      input.reminderEnabled ? 1 : 0,
      input.reminderOffsetMinutes ?? null,
      now,
      now,
      isTop ? 1 : 0,
    )
    .run();
  const created = await getPriority(id);
  if (!created) {
    throw new ConflictError(
      "Complete or demote a top priority before adding another.",
    );
  }
  return created;
}

export async function updatePriority(id: string, update: PriorityUpdate) {
  const current = await getPriority(id);
  if (!current) return null;
  const status = update.status ?? current.status;
  const isTop = update.isTop ?? current.isTop !== false;
  const now = new Date(
    Math.max(Date.now(), Date.parse(current.updatedAt) + 1),
  ).toISOString();
  const archivedAt =
    update.archived === undefined
      ? (current.archivedAt ?? null)
      : update.archived
        ? now
        : null;
  const occupiesTop =
    current.status === "active" &&
    current.isTop !== false &&
    !current.archivedAt;
  const wantsTop = status === "active" && isTop && !archivedAt;
  const enteringTop = wantsTop && !occupiesTop;
  const scheduledStartAt =
    update.scheduledStartAt === undefined
      ? (current.scheduledStartAt ?? null)
      : update.scheduledStartAt;
  const scheduledEndAt =
    update.scheduledEndAt === undefined
      ? (current.scheduledEndAt ?? null)
      : update.scheduledEndAt;
  if (
    scheduledStartAt &&
    scheduledEndAt &&
    Date.parse(scheduledEndAt) <= Date.parse(scheduledStartAt)
  ) {
    throw new ValidationError("Focus time must end after it starts.");
  }
  await commandDatabase()
    .prepare(
      `UPDATE priorities
       SET title = ?, notes = ?, due_at = ?, status = ?, is_top = ?,
           position = CASE WHEN ? = 1 THEN COALESCE((
             SELECT MAX(position) + 1 FROM priorities
             WHERE status = 'active' AND is_top = 1
               AND archived_at IS NULL AND id != ?
           ), 0) ELSE position END,
           scheduled_start_at = ?, scheduled_end_at = ?,
           reminder_enabled = ?, reminder_offset_minutes = ?,
           archived_at = ?, updated_at = ?, completed_at = ?
       WHERE id = ? AND (
         ? = 0 OR (
           SELECT COUNT(*) FROM priorities
           WHERE status = 'active' AND is_top = 1
             AND archived_at IS NULL AND id != ?
         ) < 3
       )`,
    )
    .bind(
      update.title ?? current.title,
      update.notes ?? current.notes ?? "",
      update.dueAt === undefined ? current.dueAt : update.dueAt,
      status,
      isTop ? 1 : 0,
      enteringTop ? 1 : 0,
      id,
      scheduledStartAt,
      scheduledEndAt,
      update.reminderEnabled === undefined
        ? current.reminderEnabled
          ? 1
          : 0
        : update.reminderEnabled
          ? 1
          : 0,
      update.reminderOffsetMinutes === undefined
        ? (current.reminderOffsetMinutes ?? null)
        : update.reminderOffsetMinutes,
      archivedAt,
      now,
      status === "completed" ? (current.completedAt ?? now) : null,
      id,
      enteringTop ? 1 : 0,
      id,
    )
    .run();
  const updated = await getPriority(id);
  if (enteringTop && updated?.updatedAt !== now) {
    throw new ConflictError(
      "Demote a top priority before promoting or restoring another.",
    );
  }
  return updated;
}

export async function deletePriority(id: string) {
  const current = await getPriority(id);
  if (!current) return null;
  if (current.archivedAt) return current;
  const now = new Date().toISOString();
  await commandDatabase()
    .prepare(
      `UPDATE priorities
       SET archived_at = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(now, now, id)
    .run();
  return current;
}

export async function reorderPriorities(ids: string[]) {
  await ensureCommandSchema();
  const db = commandDatabase();
  const current = await db
    .prepare(
      `SELECT id FROM priorities
       WHERE status = 'active' AND is_top = 1 AND archived_at IS NULL
       ORDER BY position ASC`,
    )
    .all<{ id: string }>();
  const currentIds = current.results.map((item) => item.id);
  if (
    currentIds.length !== ids.length ||
    currentIds.some((id) => !ids.includes(id))
  ) {
    throw new ConflictError(
      "The top priorities changed elsewhere. Refresh before reordering.",
    );
  }
  const now = new Date().toISOString();
  await db.batch(
    ids.map((id, position) =>
      db
        .prepare(
          `UPDATE priorities SET position = ?, updated_at = ?
           WHERE id = ? AND status = 'active' AND is_top = 1`,
        )
        .bind(position, now, id),
    ),
  );
  return listPriorities();
}

export async function listTimeline(localDate: string) {
  await ensureCommandSchema();
  const result = await commandDatabase()
    .prepare(
      `SELECT * FROM timeline_items
       WHERE local_date = ? AND deleted_at IS NULL
       ORDER BY CASE kind WHEN 'all-day' THEN 0 ELSE 1 END,
                start_at ASC, created_at ASC
       LIMIT 100`,
    )
    .bind(localDate)
    .all<TimelineRow>();
  return result.results.map(timelineFromRow);
}

export async function getTimelineItem(id: string) {
  await ensureCommandSchema();
  const row = await commandDatabase()
    .prepare("SELECT * FROM timeline_items WHERE id = ?")
    .bind(id)
    .first<TimelineRow>();
  return row ? timelineFromRow(row) : null;
}

export async function createTimelineItem(
  input: TimelineInput,
  id = crypto.randomUUID(),
) {
  await ensureCommandSchema();
  const now = new Date().toISOString();
  const allDay = input.kind === "all-day";
  await commandDatabase()
    .prepare(
      `INSERT OR IGNORE INTO timeline_items
       (id, title, kind, status, start_at, end_at, local_date, end_local_date,
        start_time, end_time, time_zone, notes, location, event_status,
        local_version, conflict_state, source, created_at, updated_at)
       VALUES (?, ?, ?, 'scheduled', ?, ?, ?, ?, ?, ?, ?, ?, '', 'confirmed',
        1, 'none', 'local', ?, ?)`,
    )
    .bind(
      id,
      input.title,
      input.kind,
      input.startAt ?? null,
      input.endAt ?? null,
      input.localDate,
      input.localDate,
      allDay || !input.startAt
        ? null
        : localTimeInZone(input.startAt, input.timeZone),
      allDay || !input.endAt
        ? null
        : localTimeInZone(input.endAt, input.timeZone),
      input.timeZone,
      input.notes ?? "",
      now,
      now,
    )
    .run();
  return (await getTimelineItem(id))!;
}

export async function updateTimelineItem(id: string, update: TimelineUpdate) {
  const current = await getTimelineItem(id);
  if (!current) return null;
  const now = new Date().toISOString();
  const kind = update.kind ?? current.kind;
  const timeZone = update.timeZone ?? current.timeZone;
  const startAt =
    update.startAt === undefined ? current.startAt : update.startAt;
  const endAt = update.endAt === undefined ? current.endAt : update.endAt;
  const allDay = kind === "all-day";
  const localDate = update.localDate ?? current.localDate;
  const endLocalDate =
    allDay || !endAt ? localDate : localDateInZone(endAt, timeZone);
  await commandDatabase()
    .prepare(
      `UPDATE timeline_items
       SET title = ?, kind = ?, status = ?, start_at = ?, end_at = ?,
           local_date = ?, end_local_date = ?, start_time = ?, end_time = ?,
           time_zone = ?, notes = ?,
           local_version = local_version + 1, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      update.title ?? current.title,
      kind,
      update.status ?? current.status,
      startAt,
      endAt,
      localDate,
      endLocalDate,
      allDay || !startAt ? null : localTimeInZone(startAt, timeZone),
      allDay || !endAt ? null : localTimeInZone(endAt, timeZone),
      timeZone,
      update.notes ?? current.notes,
      now,
      id,
    )
    .run();
  return getTimelineItem(id);
}

export async function deleteTimelineItem(id: string) {
  const current = await getTimelineItem(id);
  if (!current) return null;
  const db = commandDatabase();
  await db.batch([
    db
      .prepare(
        "DELETE FROM reminders WHERE entity_type = 'event' AND entity_id = ?",
      )
      .bind(id),
    db.prepare("DELETE FROM timeline_items WHERE id = ?").bind(id),
  ]);
  return current;
}

export async function createCapture(content: string, id = crypto.randomUUID()) {
  await ensureCommandSchema();
  const now = new Date().toISOString();
  await commandDatabase()
    .prepare(
      `INSERT OR IGNORE INTO quick_captures
       (id, content, source, created_at, updated_at)
       VALUES (?, ?, 'local', ?, ?)`,
    )
    .bind(id, content, now, now)
    .run();
  return {
    id,
    content,
    source: "local" as const,
    createdAt: now,
    updatedAt: now,
  };
}
