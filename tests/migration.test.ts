import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Phase 2 migration safety", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "drizzle/0001_icy_nighthawk.sql"),
    "utf8",
  );

  it("extends Phase 1 records in place and adds dedicated time tables", () => {
    expect(sql).toContain("ALTER TABLE `priorities` ADD `is_top`");
    expect(sql).toContain("ALTER TABLE `timeline_items` ADD `recurrence_rule`");
    expect(sql).toContain("CREATE TABLE `event_exceptions`");
    expect(sql).toContain("CREATE TABLE `routines`");
    expect(sql).toContain("CREATE TABLE `routine_occurrences`");
    expect(sql).toContain("CREATE TABLE `reminders`");
    expect(sql).toContain("CREATE TABLE `time_preferences`");
  });

  it("never drops or replaces the canonical Phase 1 data tables", () => {
    expect(sql).not.toMatch(/DROP TABLE `(?:priorities|timeline_items)`/);
    expect(sql).not.toMatch(/DELETE FROM `(?:priorities|timeline_items)`/);
  });
});

describe("Calendar Phase 1 metadata migration safety", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "drizzle/0002_thick_ultron.sql"),
    "utf8",
  );

  it("adds event metadata without rewriting canonical event records", () => {
    expect(sql).toContain("ALTER TABLE `timeline_items` ADD `event_metadata`");
    expect(sql).not.toMatch(/DROP TABLE|DELETE FROM|CREATE TABLE/);
  });
});

describe("Calendar Phase 2 reminder migration safety", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "drizzle/0003_slippery_wolverine.sql"),
    "utf8",
  );

  it("adds persistent reminder lifecycle records and preference controls", () => {
    expect(sql).toContain("CREATE TABLE `reminder_instances`");
    expect(sql).toContain(
      "CREATE UNIQUE INDEX `reminder_instance_occurrence_rule_idx`",
    );
    expect(sql).toContain("ALTER TABLE `time_preferences` ADD `default_view`");
    expect(sql).toContain(
      "ALTER TABLE `time_preferences` ADD `transition_buffer_minutes`",
    );
    expect(sql).toContain(
      "ALTER TABLE `time_preferences` ADD `escalation_enabled`",
    );
  });

  it("is additive and does not rewrite canonical event or reminder data", () => {
    expect(sql).not.toMatch(/DROP TABLE|DELETE FROM/);
    expect(sql).not.toMatch(
      /ALTER TABLE `(?:timeline_items|reminders)` (?:DROP|RENAME)/,
    );
  });
});

describe("Calendar Phase 3 intelligence migration safety", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "drizzle/0004_mute_mysterio.sql"),
    "utf8",
  );

  it("adds provider, privacy, proposal, conflict, and audit records", () => {
    for (const table of [
      "calendar_connections",
      "calendar_sources",
      "external_event_links",
      "calendar_sync_conflicts",
      "calendar_privacy_settings",
      "calendar_proposals",
      "calendar_audit",
      "calendar_insight_preferences",
    ]) {
      expect(sql).toContain(`CREATE TABLE \`${table}\``);
    }
  });

  it("is additive and preserves every canonical personal-time table", () => {
    expect(sql).not.toMatch(/DROP TABLE|DELETE FROM/);
    expect(sql).not.toMatch(
      /ALTER TABLE `(?:timeline_items|priorities|routines|reminders)`/,
    );
  });
});
