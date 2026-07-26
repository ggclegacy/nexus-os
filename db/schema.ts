import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const priorities = sqliteTable(
  "priorities",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    notes: text("notes").notNull().default(""),
    dueAt: text("due_at"),
    status: text("status", { enum: ["active", "completed"] })
      .notNull()
      .default("active"),
    position: integer("position").notNull().default(0),
    isTop: integer("is_top").notNull().default(1),
    scheduledStartAt: text("scheduled_start_at"),
    scheduledEndAt: text("scheduled_end_at"),
    archivedAt: text("archived_at"),
    reminderEnabled: integer("reminder_enabled").notNull().default(0),
    reminderOffsetMinutes: integer("reminder_offset_minutes"),
    source: text("source").notNull().default("local"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("priorities_top_position_idx").on(
      table.status,
      table.isTop,
      table.position,
    ),
    index("priorities_due_at_idx").on(table.dueAt),
    check(
      "priorities_status_check",
      sql`${table.status} in ('active', 'completed')`,
    ),
  ],
);

export const timelineItems = sqliteTable(
  "timeline_items",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    kind: text("kind", { enum: ["event", "all-day", "routine"] }).notNull(),
    status: text("status", {
      enum: ["scheduled", "completed", "skipped"],
    })
      .notNull()
      .default("scheduled"),
    startAt: text("start_at"),
    endAt: text("end_at"),
    localDate: text("local_date").notNull(),
    timeZone: text("time_zone").notNull(),
    notes: text("notes").notNull().default(""),
    location: text("location").notNull().default(""),
    category: text("category"),
    eventStatus: text("event_status").notNull().default("confirmed"),
    endLocalDate: text("end_local_date"),
    startTime: text("start_time"),
    endTime: text("end_time"),
    recurrenceRule: text("recurrence_rule"),
    sourceId: text("source_id"),
    externalCalendarId: text("external_calendar_id"),
    lastSyncedAt: text("last_synced_at"),
    localVersion: integer("local_version").notNull().default(1),
    remoteVersion: text("remote_version"),
    readOnly: integer("read_only").notNull().default(0),
    conflictState: text("conflict_state").notNull().default("none"),
    deletedAt: text("deleted_at"),
    migratedToRoutineId: text("migrated_to_routine_id"),
    source: text("source").notNull().default("local"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("timeline_local_date_idx").on(table.localDate, table.startAt),
    index("timeline_recurrence_range_idx").on(table.localDate, table.deletedAt),
    check(
      "timeline_kind_check",
      sql`${table.kind} in ('event', 'all-day', 'routine')`,
    ),
    check(
      "timeline_status_check",
      sql`${table.status} in ('scheduled', 'completed', 'skipped')`,
    ),
  ],
);

export const quickCaptures = sqliteTable("quick_captures", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  source: text("source").notNull().default("local"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const eventExceptions = sqliteTable(
  "event_exceptions",
  {
    id: text("id").primaryKey(),
    seriesId: text("series_id").notNull(),
    originalDate: text("original_date").notNull(),
    kind: text("kind").notNull(),
    overrideJson: text("override_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("event_exception_series_date_idx").on(
      table.seriesId,
      table.originalDate,
    ),
    check(
      "event_exception_kind_check",
      sql`${table.kind} in ('edited', 'canceled', 'additional')`,
    ),
  ],
);

export const routines = sqliteTable(
  "routines",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    recurrenceRule: text("recurrence_rule").notNull(),
    preferredTime: text("preferred_time"),
    windowStart: text("window_start"),
    windowEnd: text("window_end"),
    expectedMinutes: integer("expected_minutes"),
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
    state: text("state").notNull().default("active"),
    reminderEnabled: integer("reminder_enabled").notNull().default(0),
    reminderOffsetMinutes: integer("reminder_offset_minutes"),
    source: text("source").notNull().default("local"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("routines_state_start_idx").on(table.state, table.startDate),
    check(
      "routine_state_check",
      sql`${table.state} in ('active', 'paused', 'archived')`,
    ),
  ],
);

export const routineOccurrences = sqliteTable(
  "routine_occurrences",
  {
    id: text("id").primaryKey(),
    routineId: text("routine_id").notNull(),
    scheduledDate: text("scheduled_date").notNull(),
    status: text("status").notNull(),
    completedAt: text("completed_at"),
    note: text("note").notNull().default(""),
    source: text("source").notNull().default("local"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("routine_occurrence_date_idx").on(
      table.routineId,
      table.scheduledDate,
    ),
    check(
      "routine_occurrence_status_check",
      sql`${table.status} in ('upcoming', 'due', 'completed', 'skipped')`,
    ),
  ],
);

export const reminders = sqliteTable(
  "reminders",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    offsetMinutes: integer("offset_minutes").notNull(),
    channel: text("channel").notNull().default("in-app"),
    enabled: integer("enabled").notNull().default(1),
    quietBehavior: text("quiet_behavior").notNull().default("delay"),
    deliveryStatus: text("delivery_status").notNull().default("pending"),
    deliveredAt: text("delivered_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("reminders_entity_idx").on(table.entityType, table.entityId),
    check(
      "reminder_entity_check",
      sql`${table.entityType} in ('event', 'priority', 'routine')`,
    ),
  ],
);

export const timePreferences = sqliteTable("time_preferences", {
  id: text("id").primaryKey().default("default"),
  timeZone: text("time_zone").notNull().default("UTC"),
  locale: text("locale").notNull().default("en-US"),
  weekStartsOn: integer("week_starts_on").notNull().default(1),
  hourCycle: text("hour_cycle").notNull().default("12"),
  quietHoursEnabled: integer("quiet_hours_enabled").notNull().default(0),
  quietHoursStart: text("quiet_hours_start").notNull().default("22:00"),
  quietHoursEnd: text("quiet_hours_end").notNull().default("07:00"),
  quietBehavior: text("quiet_behavior").notNull().default("delay"),
  notificationPermission: text("notification_permission")
    .notNull()
    .default("in-app-only"),
  updatedAt: text("updated_at").notNull(),
});
