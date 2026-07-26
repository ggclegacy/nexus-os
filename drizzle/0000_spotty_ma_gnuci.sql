CREATE TABLE `priorities` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`due_at` text,
	`status` text DEFAULT 'active' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'local' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text,
	CONSTRAINT "priorities_status_check" CHECK("priorities"."status" in ('active', 'completed'))
);
--> statement-breakpoint
CREATE INDEX `priorities_status_position_idx` ON `priorities` (`status`,`position`);--> statement-breakpoint
CREATE TABLE `quick_captures` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`source` text DEFAULT 'local' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `timeline_items` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`start_at` text,
	`end_at` text,
	`local_date` text NOT NULL,
	`time_zone` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'local' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "timeline_kind_check" CHECK("timeline_items"."kind" in ('event', 'all-day', 'routine')),
	CONSTRAINT "timeline_status_check" CHECK("timeline_items"."status" in ('scheduled', 'completed', 'skipped'))
);
--> statement-breakpoint
CREATE INDEX `timeline_local_date_idx` ON `timeline_items` (`local_date`,`start_at`);