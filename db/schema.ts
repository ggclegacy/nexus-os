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
    eventMetadata: text("event_metadata").notNull().default("{}"),
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

export const reminderInstances = sqliteTable(
  "reminder_instances",
  {
    id: text("id").primaryKey(),
    reminderId: text("reminder_id").notNull(),
    eventId: text("event_id").notNull(),
    occurrenceDate: text("occurrence_date").notNull(),
    occurrenceKey: text("occurrence_key").notNull(),
    scheduledFor: text("scheduled_for").notNull(),
    deliveredAt: text("delivered_at"),
    seenAt: text("seen_at"),
    snoozedUntil: text("snoozed_until"),
    resolvedAt: text("resolved_at"),
    state: text("state").notNull().default("scheduled"),
    reason: text("reason").notNull(),
    ruleLabel: text("rule_label").notNull(),
    escalationLevel: integer("escalation_level").notNull().default(0),
    nextEscalationAt: text("next_escalation_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("reminder_instance_occurrence_rule_idx").on(
      table.reminderId,
      table.occurrenceKey,
    ),
    index("reminder_instance_state_due_idx").on(
      table.state,
      table.scheduledFor,
    ),
    check(
      "reminder_instance_state_check",
      sql`${table.state} in ('scheduled', 'delivered', 'seen', 'snoozed', 'resolved', 'dismissed', 'expired')`,
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
  defaultView: text("default_view").notNull().default("day"),
  defaultEventDurationMinutes: integer("default_event_duration_minutes")
    .notNull()
    .default(60),
  transitionBufferMinutes: integer("transition_buffer_minutes")
    .notNull()
    .default(15),
  morningBriefTime: text("morning_brief_time").notNull().default("07:00"),
  eveningBriefTime: text("evening_brief_time").notNull().default("20:00"),
  escalationEnabled: integer("escalation_enabled").notNull().default(1),
  defaultSnoozeMinutes: integer("default_snooze_minutes").notNull().default(60),
  overloadMinutesPerDay: integer("overload_minutes_per_day")
    .notNull()
    .default(480),
  overloadImportantItemCount: integer("overload_important_item_count")
    .notNull()
    .default(5),
  updatedAt: text("updated_at").notNull(),
});

export const calendarConnections = sqliteTable(
  "calendar_connections",
  {
    id: text("id").primaryKey(),
    provider: text("provider", { enum: ["google"] }).notNull(),
    accountId: text("account_id").notNull(),
    accountEmail: text("account_email").notNull(),
    displayName: text("display_name").notNull(),
    status: text("status", {
      enum: ["healthy", "syncing", "attention", "disconnected"],
    })
      .notNull()
      .default("healthy"),
    encryptedAccessToken: text("encrypted_access_token").notNull(),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    tokenExpiresAt: text("token_expires_at"),
    scopesJson: text("scopes_json").notNull().default("[]"),
    lastSyncedAt: text("last_synced_at"),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("calendar_connection_provider_account_idx").on(
      table.provider,
      table.accountId,
    ),
    check(
      "calendar_connection_status_check",
      sql`${table.status} in ('healthy', 'syncing', 'attention', 'disconnected')`,
    ),
  ],
);

export const calendarSources = sqliteTable(
  "calendar_sources",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id"),
    provider: text("provider").notNull(),
    externalCalendarId: text("external_calendar_id"),
    displayName: text("display_name").notNull(),
    access: text("access", { enum: ["read", "write"] })
      .notNull()
      .default("read"),
    visible: integer("visible").notNull().default(1),
    includeInAvailability: integer("include_in_availability")
      .notNull()
      .default(1),
    includeInAtlas: integer("include_in_atlas").notNull().default(1),
    isDefault: integer("is_default").notNull().default(0),
    syncStatus: text("sync_status", {
      enum: ["healthy", "syncing", "attention", "disconnected"],
    })
      .notNull()
      .default("healthy"),
    syncCursor: text("sync_cursor"),
    lastSyncedAt: text("last_synced_at"),
    colorKey: text("color_key", { enum: ["gold", "green", "stone"] })
      .notNull()
      .default("stone"),
  },
  (table) => [
    uniqueIndex("calendar_source_provider_external_idx").on(
      table.provider,
      table.connectionId,
      table.externalCalendarId,
    ),
    index("calendar_sources_connection_idx").on(
      table.connectionId,
      table.visible,
    ),
  ],
);

export const externalEventLinks = sqliteTable(
  "external_event_links",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id").notNull(),
    localEventId: text("local_event_id").notNull(),
    externalEventId: text("external_event_id").notNull(),
    externalSeriesId: text("external_series_id"),
    providerVersion: text("provider_version"),
    lastPulledAt: text("last_pulled_at"),
    lastPushedAt: text("last_pushed_at"),
    lastSyncedHash: text("last_synced_hash"),
    lastLocalVersion: integer("last_local_version").notNull().default(1),
    pendingAction: text("pending_action"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("external_event_links_source_event_idx").on(
      table.sourceId,
      table.externalEventId,
    ),
    uniqueIndex("external_event_links_local_idx").on(table.localEventId),
  ],
);

export const calendarSyncConflicts = sqliteTable(
  "calendar_sync_conflicts",
  {
    id: text("id").primaryKey(),
    linkId: text("link_id").notNull(),
    localEventId: text("local_event_id").notNull(),
    sourceId: text("source_id").notNull(),
    differingFieldsJson: text("differing_fields_json").notNull().default("[]"),
    localJson: text("local_json").notNull().default("{}"),
    providerJson: text("provider_json").notNull().default("{}"),
    status: text("status").notNull().default("open"),
    createdAt: text("created_at").notNull(),
    resolvedAt: text("resolved_at"),
  },
  (table) => [
    index("calendar_conflicts_status_idx").on(table.status, table.createdAt),
  ],
);

export const calendarPrivacySettings = sqliteTable(
  "calendar_privacy_settings",
  {
    id: text("id").primaryKey().default("default"),
    sensitiveEventsInAtlas: integer("sensitive_events_in_atlas")
      .notNull()
      .default(0),
    patternInsights: integer("pattern_insights").notNull().default(1),
    semanticSearch: integer("semantic_search").notNull().default(1),
    immediateCreateWithUndo: integer("immediate_create_with_undo")
      .notNull()
      .default(0),
    disconnectedDataRetention: text("disconnected_data_retention", {
      enum: ["remove", "snapshot"],
    })
      .notNull()
      .default("remove"),
    updatedAt: text("updated_at").notNull(),
  },
);

export const calendarProposals = sqliteTable("calendar_proposals", {
  id: text("id").primaryKey(),
  proposalJson: text("proposal_json").notNull(),
  status: text("status").notNull().default("draft"),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const calendarAudit = sqliteTable(
  "calendar_audit",
  {
    id: text("id").primaryKey(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    source: text("source").notNull(),
    eventIdsJson: text("event_ids_json").notNull().default("[]"),
    summary: text("summary").notNull(),
    providerResult: text("provider_result"),
    proposalId: text("proposal_id"),
    undoAvailable: integer("undo_available").notNull().default(0),
    beforeJson: text("before_json").notNull().default("[]"),
    afterJson: text("after_json").notNull().default("[]"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("calendar_audit_created_idx").on(table.createdAt)],
);

export const calendarInsightPreferences = sqliteTable(
  "calendar_insight_preferences",
  {
    insightKey: text("insight_key").primaryKey(),
    dismissed: integer("dismissed").notNull().default(0),
    muted: integer("muted").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
  },
);
