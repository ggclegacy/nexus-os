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
