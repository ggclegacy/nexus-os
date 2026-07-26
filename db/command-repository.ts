import { env } from "cloudflare:workers";
import type {
  Priority,
  PriorityInput,
  PriorityUpdate,
  TimelineInput,
  TimelineItem,
  TimelineUpdate,
} from "../lib/domain/types";

type PriorityRow = {
  id: string;
  title: string;
  due_at: string | null;
  status: "active" | "completed";
  position: number;
  source: "local";
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type TimelineRow = {
  id: string;
  title: string;
  kind: "event" | "all-day" | "routine";
  status: "scheduled" | "completed" | "skipped";
  start_at: string | null;
  end_at: string | null;
  local_date: string;
  time_zone: string;
  notes: string;
  source: "local";
  created_at: string;
  updated_at: string;
};

function database() {
  if (!env.DB) {
    throw new Error("Local command storage is unavailable.");
  }
  return env.DB;
}

let initialization: Promise<void> | null = null;

export function ensureCommandSchema() {
  if (initialization) return initialization;
  const db = database();
  initialization = db
    .batch([
      db.prepare(`
        CREATE TABLE IF NOT EXISTS priorities (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          due_at TEXT,
          status TEXT NOT NULL DEFAULT 'active'
            CHECK (status IN ('active', 'completed')),
          position INTEGER NOT NULL DEFAULT 0,
          source TEXT NOT NULL DEFAULT 'local',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT
        )
      `),
      db.prepare(`
        CREATE INDEX IF NOT EXISTS priorities_status_position_idx
        ON priorities (status, position)
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
          time_zone TEXT NOT NULL,
          notes TEXT NOT NULL DEFAULT '',
          source TEXT NOT NULL DEFAULT 'local',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE INDEX IF NOT EXISTS timeline_local_date_idx
        ON timeline_items (local_date, start_at)
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
    ])
    .then(() => undefined)
    .catch((error: unknown) => {
      initialization = null;
      throw error;
    });
  return initialization;
}

function priorityFromRow(row: PriorityRow): Priority {
  return {
    id: row.id,
    title: row.title,
    dueAt: row.due_at,
    status: row.status,
    position: row.position,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function timelineFromRow(row: TimelineRow): TimelineItem {
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
  };
}

export async function listPriorities() {
  await ensureCommandSchema();
  const result = await database()
    .prepare(
      `SELECT * FROM priorities
       ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END,
                position ASC, updated_at DESC
       LIMIT 50`,
    )
    .all<PriorityRow>();
  return result.results.map(priorityFromRow);
}

export async function getPriority(id: string) {
  await ensureCommandSchema();
  const row = await database()
    .prepare("SELECT * FROM priorities WHERE id = ?")
    .bind(id)
    .first<PriorityRow>();
  return row ? priorityFromRow(row) : null;
}

export async function createPriority(input: PriorityInput) {
  await ensureCommandSchema();
  const db = database();
  const count = await db
    .prepare("SELECT COUNT(*) AS count FROM priorities WHERE status = 'active'")
    .first<{ count: number }>();
  if ((count?.count ?? 0) >= 3) {
    throw new Error("Complete or remove a top priority before adding another.");
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO priorities
       (id, title, due_at, status, position, source, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, 'local', ?, ?)`,
    )
    .bind(id, input.title, input.dueAt ?? null, count?.count ?? 0, now, now)
    .run();
  return (await getPriority(id))!;
}

export async function updatePriority(id: string, update: PriorityUpdate) {
  const current = await getPriority(id);
  if (!current) return null;
  const status = update.status ?? current.status;
  const now = new Date().toISOString();
  await database()
    .prepare(
      `UPDATE priorities
       SET title = ?, due_at = ?, status = ?, updated_at = ?,
           completed_at = ?
       WHERE id = ?`,
    )
    .bind(
      update.title ?? current.title,
      update.dueAt === undefined ? current.dueAt : update.dueAt,
      status,
      now,
      status === "completed" ? (current.completedAt ?? now) : null,
      id,
    )
    .run();
  return getPriority(id);
}

export async function deletePriority(id: string) {
  const current = await getPriority(id);
  if (!current) return null;
  await database()
    .prepare("DELETE FROM priorities WHERE id = ?")
    .bind(id)
    .run();
  return current;
}

export async function reorderPriorities(ids: string[]) {
  await ensureCommandSchema();
  const db = database();
  await db.batch(
    ids.map((id, position) =>
      db
        .prepare(
          "UPDATE priorities SET position = ?, updated_at = ? WHERE id = ? AND status = 'active'",
        )
        .bind(position, new Date().toISOString(), id),
    ),
  );
  return listPriorities();
}

export async function listTimeline(localDate: string) {
  await ensureCommandSchema();
  const result = await database()
    .prepare(
      `SELECT * FROM timeline_items
       WHERE local_date = ?
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
  const row = await database()
    .prepare("SELECT * FROM timeline_items WHERE id = ?")
    .bind(id)
    .first<TimelineRow>();
  return row ? timelineFromRow(row) : null;
}

export async function createTimelineItem(input: TimelineInput) {
  await ensureCommandSchema();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await database()
    .prepare(
      `INSERT INTO timeline_items
       (id, title, kind, status, start_at, end_at, local_date, time_zone,
        notes, source, created_at, updated_at)
       VALUES (?, ?, ?, 'scheduled', ?, ?, ?, ?, ?, 'local', ?, ?)`,
    )
    .bind(
      id,
      input.title,
      input.kind,
      input.startAt ?? null,
      input.endAt ?? null,
      input.localDate,
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
  await database()
    .prepare(
      `UPDATE timeline_items
       SET title = ?, kind = ?, status = ?, start_at = ?, end_at = ?,
           local_date = ?, time_zone = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      update.title ?? current.title,
      update.kind ?? current.kind,
      update.status ?? current.status,
      update.startAt === undefined ? current.startAt : update.startAt,
      update.endAt === undefined ? current.endAt : update.endAt,
      update.localDate ?? current.localDate,
      update.timeZone ?? current.timeZone,
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
  await database()
    .prepare("DELETE FROM timeline_items WHERE id = ?")
    .bind(id)
    .run();
  return current;
}

export async function createCapture(content: string) {
  await ensureCommandSchema();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await database()
    .prepare(
      `INSERT INTO quick_captures
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
