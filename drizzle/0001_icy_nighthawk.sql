CREATE TABLE `event_exceptions` (
	`id` text PRIMARY KEY NOT NULL,
	`series_id` text NOT NULL,
	`original_date` text NOT NULL,
	`kind` text NOT NULL,
	`override_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "event_exception_kind_check" CHECK("event_exceptions"."kind" in ('edited', 'canceled', 'additional'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_exception_series_date_idx` ON `event_exceptions` (`series_id`,`original_date`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`offset_minutes` integer NOT NULL,
	`channel` text DEFAULT 'in-app' NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`quiet_behavior` text DEFAULT 'delay' NOT NULL,
	`delivery_status` text DEFAULT 'pending' NOT NULL,
	`delivered_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "reminder_entity_check" CHECK("reminders"."entity_type" in ('event', 'priority', 'routine'))
);
--> statement-breakpoint
CREATE INDEX `reminders_entity_idx` ON `reminders` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `routine_occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`routine_id` text NOT NULL,
	`scheduled_date` text NOT NULL,
	`status` text NOT NULL,
	`completed_at` text,
	`note` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'local' NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "routine_occurrence_status_check" CHECK("routine_occurrences"."status" in ('upcoming', 'due', 'completed', 'skipped'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routine_occurrence_date_idx` ON `routine_occurrences` (`routine_id`,`scheduled_date`);--> statement-breakpoint
CREATE TABLE `routines` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`recurrence_rule` text NOT NULL,
	`preferred_time` text,
	`window_start` text,
	`window_end` text,
	`expected_minutes` integer,
	`start_date` text NOT NULL,
	`end_date` text,
	`state` text DEFAULT 'active' NOT NULL,
	`reminder_enabled` integer DEFAULT 0 NOT NULL,
	`reminder_offset_minutes` integer,
	`source` text DEFAULT 'local' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "routine_state_check" CHECK("routines"."state" in ('active', 'paused', 'archived'))
);
--> statement-breakpoint
CREATE INDEX `routines_state_start_idx` ON `routines` (`state`,`start_date`);--> statement-breakpoint
CREATE TABLE `time_preferences` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`time_zone` text DEFAULT 'UTC' NOT NULL,
	`locale` text DEFAULT 'en-US' NOT NULL,
	`week_starts_on` integer DEFAULT 1 NOT NULL,
	`hour_cycle` text DEFAULT '12' NOT NULL,
	`quiet_hours_enabled` integer DEFAULT 0 NOT NULL,
	`quiet_hours_start` text DEFAULT '22:00' NOT NULL,
	`quiet_hours_end` text DEFAULT '07:00' NOT NULL,
	`quiet_behavior` text DEFAULT 'delay' NOT NULL,
	`notification_permission` text DEFAULT 'in-app-only' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
DROP INDEX `priorities_status_position_idx`;--> statement-breakpoint
ALTER TABLE `priorities` ADD `notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `priorities` ADD `is_top` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `priorities` ADD `scheduled_start_at` text;--> statement-breakpoint
ALTER TABLE `priorities` ADD `scheduled_end_at` text;--> statement-breakpoint
ALTER TABLE `priorities` ADD `archived_at` text;--> statement-breakpoint
ALTER TABLE `priorities` ADD `reminder_enabled` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `priorities` ADD `reminder_offset_minutes` integer;--> statement-breakpoint
CREATE INDEX `priorities_top_position_idx` ON `priorities` (`status`,`is_top`,`position`);--> statement-breakpoint
CREATE INDEX `priorities_due_at_idx` ON `priorities` (`due_at`);--> statement-breakpoint
ALTER TABLE `timeline_items` ADD `location` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `timeline_items` ADD `category` text;--> statement-breakpoint
ALTER TABLE `timeline_items` ADD `event_status` text DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
ALTER TABLE `timeline_items` ADD `end_local_date` text;--> statement-breakpoint
ALTER TABLE `timeline_items` ADD `start_time` text;--> statement-breakpoint
ALTER TABLE `timeline_items` ADD `end_time` text;--> statement-breakpoint
ALTER TABLE `timeline_items` ADD `recurrence_rule` text;--> statement-breakpoint
ALTER TABLE `timeline_items` ADD `source_id` text;--> statement-breakpoint
ALTER TABLE `timeline_items` ADD `external_calendar_id` text;--> statement-breakpoint
ALTER TABLE `timeline_items` ADD `last_synced_at` text;--> statement-breakpoint
ALTER TABLE `timeline_items` ADD `local_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `timeline_items` ADD `remote_version` text;--> statement-breakpoint
ALTER TABLE `timeline_items` ADD `read_only` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `timeline_items` ADD `conflict_state` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `timeline_items` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `timeline_items` ADD `migrated_to_routine_id` text;--> statement-breakpoint
CREATE INDEX `timeline_recurrence_range_idx` ON `timeline_items` (`local_date`,`deleted_at`);