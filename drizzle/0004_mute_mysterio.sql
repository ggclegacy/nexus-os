CREATE TABLE `calendar_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`source` text NOT NULL,
	`event_ids_json` text DEFAULT '[]' NOT NULL,
	`summary` text NOT NULL,
	`provider_result` text,
	`proposal_id` text,
	`undo_available` integer DEFAULT 0 NOT NULL,
	`before_json` text DEFAULT '[]' NOT NULL,
	`after_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `calendar_audit_created_idx` ON `calendar_audit` (`created_at`);--> statement-breakpoint
CREATE TABLE `calendar_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`account_id` text NOT NULL,
	`account_email` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'healthy' NOT NULL,
	`encrypted_access_token` text NOT NULL,
	`encrypted_refresh_token` text,
	`token_expires_at` text,
	`scopes_json` text DEFAULT '[]' NOT NULL,
	`last_synced_at` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "calendar_connection_status_check" CHECK("calendar_connections"."status" in ('healthy', 'syncing', 'attention', 'disconnected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_connection_provider_account_idx` ON `calendar_connections` (`provider`,`account_id`);--> statement-breakpoint
CREATE TABLE `calendar_insight_preferences` (
	`insight_key` text PRIMARY KEY NOT NULL,
	`dismissed` integer DEFAULT 0 NOT NULL,
	`muted` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `calendar_privacy_settings` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`sensitive_events_in_atlas` integer DEFAULT 0 NOT NULL,
	`pattern_insights` integer DEFAULT 1 NOT NULL,
	`semantic_search` integer DEFAULT 1 NOT NULL,
	`immediate_create_with_undo` integer DEFAULT 0 NOT NULL,
	`disconnected_data_retention` text DEFAULT 'remove' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `calendar_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_json` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `calendar_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text,
	`provider` text NOT NULL,
	`external_calendar_id` text,
	`display_name` text NOT NULL,
	`access` text DEFAULT 'read' NOT NULL,
	`visible` integer DEFAULT 1 NOT NULL,
	`include_in_availability` integer DEFAULT 1 NOT NULL,
	`include_in_atlas` integer DEFAULT 1 NOT NULL,
	`is_default` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'healthy' NOT NULL,
	`sync_cursor` text,
	`last_synced_at` text,
	`color_key` text DEFAULT 'stone' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_source_provider_external_idx` ON `calendar_sources` (`provider`,`connection_id`,`external_calendar_id`);--> statement-breakpoint
CREATE INDEX `calendar_sources_connection_idx` ON `calendar_sources` (`connection_id`,`visible`);--> statement-breakpoint
CREATE TABLE `calendar_sync_conflicts` (
	`id` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	`local_event_id` text NOT NULL,
	`source_id` text NOT NULL,
	`differing_fields_json` text DEFAULT '[]' NOT NULL,
	`local_json` text DEFAULT '{}' NOT NULL,
	`provider_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
CREATE INDEX `calendar_conflicts_status_idx` ON `calendar_sync_conflicts` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `external_event_links` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`local_event_id` text NOT NULL,
	`external_event_id` text NOT NULL,
	`external_series_id` text,
	`provider_version` text,
	`last_pulled_at` text,
	`last_pushed_at` text,
	`last_synced_hash` text,
	`last_local_version` integer DEFAULT 1 NOT NULL,
	`pending_action` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_event_links_source_event_idx` ON `external_event_links` (`source_id`,`external_event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `external_event_links_local_idx` ON `external_event_links` (`local_event_id`);