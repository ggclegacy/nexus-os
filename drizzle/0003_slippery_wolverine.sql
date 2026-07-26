CREATE TABLE `reminder_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`reminder_id` text NOT NULL,
	`event_id` text NOT NULL,
	`occurrence_date` text NOT NULL,
	`occurrence_key` text NOT NULL,
	`scheduled_for` text NOT NULL,
	`delivered_at` text,
	`seen_at` text,
	`snoozed_until` text,
	`resolved_at` text,
	`state` text DEFAULT 'scheduled' NOT NULL,
	`reason` text NOT NULL,
	`rule_label` text NOT NULL,
	`escalation_level` integer DEFAULT 0 NOT NULL,
	`next_escalation_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "reminder_instance_state_check" CHECK("reminder_instances"."state" in ('scheduled', 'delivered', 'seen', 'snoozed', 'resolved', 'dismissed', 'expired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reminder_instance_occurrence_rule_idx` ON `reminder_instances` (`reminder_id`,`occurrence_key`);--> statement-breakpoint
CREATE INDEX `reminder_instance_state_due_idx` ON `reminder_instances` (`state`,`scheduled_for`);--> statement-breakpoint
ALTER TABLE `time_preferences` ADD `default_view` text DEFAULT 'day' NOT NULL;--> statement-breakpoint
ALTER TABLE `time_preferences` ADD `default_event_duration_minutes` integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `time_preferences` ADD `transition_buffer_minutes` integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `time_preferences` ADD `morning_brief_time` text DEFAULT '07:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `time_preferences` ADD `evening_brief_time` text DEFAULT '20:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `time_preferences` ADD `escalation_enabled` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `time_preferences` ADD `default_snooze_minutes` integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `time_preferences` ADD `overload_minutes_per_day` integer DEFAULT 480 NOT NULL;--> statement-breakpoint
ALTER TABLE `time_preferences` ADD `overload_important_item_count` integer DEFAULT 5 NOT NULL;