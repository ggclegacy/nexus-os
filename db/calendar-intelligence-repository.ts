import type {
  CalendarAuditEntry,
  CalendarConnection,
  CalendarPrivacySettings,
  CalendarProposal,
  CalendarProvider,
  CalendarSource,
  PatternInsight,
  SyncConflict,
  SyncOperationState,
} from "../lib/calendar-intelligence/types";
import type { CalendarEventInput } from "../lib/time/types";
import { commandDatabase } from "./command-repository";
import { ensureTimeSchema } from "./time-repository";

type ConnectionRow = {
  id: string;
  provider: CalendarProvider;
  account_id: string;
  account_email: string;
  display_name: string;
  status: CalendarConnection["status"];
  encrypted_access_token: string;
  encrypted_refresh_token: string | null;
  token_expires_at: string | null;
  scopes_json: string;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type SourceRow = {
  id: string;
  connection_id: string | null;
  provider: CalendarSource["provider"];
  external_calendar_id: string | null;
  display_name: string;
  access: CalendarSource["access"];
  visible: number;
  include_in_availability: number;
  include_in_atlas: number;
  is_default: number;
  sync_status: CalendarSource["syncStatus"];
  sync_cursor: string | null;
  last_synced_at: string | null;
  color_key: CalendarSource["colorKey"];
};

type ConflictRow = {
  id: string;
  link_id: string;
  local_event_id: string;
  source_id: string;
  differing_fields_json: string;
  local_json: string;
  provider_json: string;
  status: SyncConflict["status"];
  created_at: string;
  resolved_at: string | null;
};

type PrivacyRow = {
  sensitive_events_in_atlas: number;
  pattern_insights: number;
  semantic_search: number;
  immediate_create_with_undo: number;
  disconnected_data_retention: "remove" | "snapshot";
  updated_at: string;
};

type AuditRow = {
  id: string;
  actor: CalendarAuditEntry["actor"];
  action: string;
  source: string;
  event_ids_json: string;
  summary: string;
  provider_result: SyncOperationState | null;
  proposal_id: string | null;
  undo_available: number;
  before_json: string;
  after_json: string;
  created_at: string;
};

type LinkRow = {
  id: string;
  source_id: string;
  local_event_id: string;
  external_event_id: string;
  external_series_id: string | null;
  provider_version: string | null;
  last_pulled_at: string | null;
  last_pushed_at: string | null;
  last_synced_hash: string | null;
  last_local_version: number;
  pending_action: string | null;
  created_at: string;
  updated_at: string;
};

let intelligenceInitialization: Promise<void> | null = null;

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function connectionFromRow(row: ConnectionRow): CalendarConnection {
  return {
    id: row.id,
    provider: row.provider,
    accountId: row.account_id,
    accountEmail: row.account_email,
    displayName: row.display_name,
    status: row.status,
    scopes: parseJson<string[]>(row.scopes_json, []),
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sourceFromRow(row: SourceRow): CalendarSource {
  return {
    id: row.id,
    connectionId: row.connection_id,
    provider: row.provider,
    externalCalendarId: row.external_calendar_id,
    displayName: row.display_name,
    access: row.access,
    visible: Boolean(row.visible),
    includeInAvailability: Boolean(row.include_in_availability),
    includeInAtlas: Boolean(row.include_in_atlas),
    isDefault: Boolean(row.is_default),
    syncStatus: row.sync_status,
    lastSyncedAt: row.last_synced_at,
    colorKey: row.color_key,
  };
}

function conflictFromRow(row: ConflictRow): SyncConflict {
  return {
    id: row.id,
    linkId: row.link_id,
    localEventId: row.local_event_id,
    sourceId: row.source_id,
    differingFields: parseJson(row.differing_fields_json, []),
    localVersion: parseJson(row.local_json, {}),
    providerVersion: parseJson(row.provider_json, {}),
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

function auditFromRow(row: AuditRow): CalendarAuditEntry {
  return {
    id: row.id,
    actor: row.actor,
    action: row.action,
    source: row.source,
    eventIds: parseJson(row.event_ids_json, []),
    summary: row.summary,
    providerResult: row.provider_result,
    proposalId: row.proposal_id,
    undoAvailable: Boolean(row.undo_available),
    createdAt: row.created_at,
  };
}

export async function ensureCalendarIntelligenceSchema() {
  if (intelligenceInitialization) return intelligenceInitialization;
  intelligenceInitialization = (async () => {
    await ensureTimeSchema();
    const db = commandDatabase();
    await db.batch([
      db.prepare(`
        CREATE TABLE IF NOT EXISTS calendar_connections (
          id TEXT PRIMARY KEY NOT NULL,
          provider TEXT NOT NULL CHECK (provider IN ('google')),
          account_id TEXT NOT NULL,
          account_email TEXT NOT NULL,
          display_name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'healthy'
            CHECK (status IN ('healthy', 'syncing', 'attention', 'disconnected')),
          encrypted_access_token TEXT NOT NULL,
          encrypted_refresh_token TEXT,
          token_expires_at TEXT,
          scopes_json TEXT NOT NULL DEFAULT '[]',
          last_synced_at TEXT,
          last_error TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(provider, account_id)
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS calendar_sources (
          id TEXT PRIMARY KEY NOT NULL,
          connection_id TEXT,
          provider TEXT NOT NULL,
          external_calendar_id TEXT,
          display_name TEXT NOT NULL,
          access TEXT NOT NULL DEFAULT 'read'
            CHECK (access IN ('read', 'write')),
          visible INTEGER NOT NULL DEFAULT 1,
          include_in_availability INTEGER NOT NULL DEFAULT 1,
          include_in_atlas INTEGER NOT NULL DEFAULT 1,
          is_default INTEGER NOT NULL DEFAULT 0,
          sync_status TEXT NOT NULL DEFAULT 'healthy'
            CHECK (sync_status IN ('healthy', 'syncing', 'attention', 'disconnected')),
          sync_cursor TEXT,
          last_synced_at TEXT,
          color_key TEXT NOT NULL DEFAULT 'stone'
            CHECK (color_key IN ('gold', 'green', 'stone')),
          UNIQUE(provider, connection_id, external_calendar_id)
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS external_event_links (
          id TEXT PRIMARY KEY NOT NULL,
          source_id TEXT NOT NULL,
          local_event_id TEXT NOT NULL,
          external_event_id TEXT NOT NULL,
          external_series_id TEXT,
          provider_version TEXT,
          last_pulled_at TEXT,
          last_pushed_at TEXT,
          last_synced_hash TEXT,
          last_local_version INTEGER NOT NULL DEFAULT 1,
          pending_action TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(source_id, external_event_id),
          UNIQUE(local_event_id)
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS calendar_sync_conflicts (
          id TEXT PRIMARY KEY NOT NULL,
          link_id TEXT NOT NULL,
          local_event_id TEXT NOT NULL,
          source_id TEXT NOT NULL,
          differing_fields_json TEXT NOT NULL DEFAULT '[]',
          local_json TEXT NOT NULL DEFAULT '{}',
          provider_json TEXT NOT NULL DEFAULT '{}',
          status TEXT NOT NULL DEFAULT 'open',
          created_at TEXT NOT NULL,
          resolved_at TEXT
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS calendar_privacy_settings (
          id TEXT PRIMARY KEY NOT NULL DEFAULT 'default',
          sensitive_events_in_atlas INTEGER NOT NULL DEFAULT 0,
          pattern_insights INTEGER NOT NULL DEFAULT 1,
          semantic_search INTEGER NOT NULL DEFAULT 1,
          immediate_create_with_undo INTEGER NOT NULL DEFAULT 0,
          disconnected_data_retention TEXT NOT NULL DEFAULT 'remove'
            CHECK (disconnected_data_retention IN ('remove', 'snapshot')),
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS calendar_proposals (
          id TEXT PRIMARY KEY NOT NULL,
          proposal_json TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS calendar_audit (
          id TEXT PRIMARY KEY NOT NULL,
          actor TEXT NOT NULL,
          action TEXT NOT NULL,
          source TEXT NOT NULL,
          event_ids_json TEXT NOT NULL DEFAULT '[]',
          summary TEXT NOT NULL,
          provider_result TEXT,
          proposal_id TEXT,
          undo_available INTEGER NOT NULL DEFAULT 0,
          before_json TEXT NOT NULL DEFAULT '[]',
          after_json TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS calendar_insight_preferences (
          insight_key TEXT PRIMARY KEY NOT NULL,
          dismissed INTEGER NOT NULL DEFAULT 0,
          muted INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS calendar_sources_connection_idx
         ON calendar_sources(connection_id, visible)`,
      ),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS external_event_links_source_idx
         ON external_event_links(source_id, external_event_id)`,
      ),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS calendar_conflicts_status_idx
         ON calendar_sync_conflicts(status, created_at)`,
      ),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS calendar_audit_created_idx
         ON calendar_audit(created_at)`,
      ),
    ]);
    const now = new Date().toISOString();
    await db.batch([
      db.prepare(
        `INSERT OR IGNORE INTO calendar_sources
           (id, connection_id, provider, external_calendar_id, display_name,
            access, visible, include_in_availability, include_in_atlas,
            is_default, sync_status, sync_cursor, last_synced_at, color_key)
           VALUES ('nexus', NULL, 'nexus', NULL, 'Nexus Calendar', 'write', 1,
                   1, 1, 1, 'healthy', NULL, NULL, 'gold')`,
      ),
      db
        .prepare(
          `INSERT OR IGNORE INTO calendar_privacy_settings
           (id, sensitive_events_in_atlas, pattern_insights, semantic_search,
            immediate_create_with_undo, disconnected_data_retention, updated_at)
           VALUES ('default', 0, 1, 1, 0, 'remove', ?)`,
        )
        .bind(now),
    ]);
  })().catch((error) => {
    intelligenceInitialization = null;
    throw error;
  });
  return intelligenceInitialization;
}

export async function listCalendarConnections() {
  await ensureCalendarIntelligenceSchema();
  const rows = await commandDatabase()
    .prepare(
      `SELECT * FROM calendar_connections
       WHERE status != 'disconnected'
       ORDER BY provider ASC, account_email ASC`,
    )
    .all<ConnectionRow>();
  return rows.results.map(connectionFromRow);
}

export async function listCalendarSources() {
  await ensureCalendarIntelligenceSchema();
  const rows = await commandDatabase()
    .prepare(
      `SELECT * FROM calendar_sources
       ORDER BY is_default DESC, provider ASC, display_name ASC`,
    )
    .all<SourceRow>();
  return rows.results.map(sourceFromRow);
}

export async function getCalendarSource(id: string) {
  await ensureCalendarIntelligenceSchema();
  const row = await commandDatabase()
    .prepare("SELECT * FROM calendar_sources WHERE id = ?")
    .bind(id)
    .first<SourceRow>();
  return row ? sourceFromRow(row) : null;
}

export async function updateCalendarSource(
  id: string,
  update: Partial<
    Pick<
      CalendarSource,
      "visible" | "includeInAvailability" | "includeInAtlas" | "isDefault"
    >
  >,
) {
  await ensureCalendarIntelligenceSchema();
  const current = await getCalendarSource(id);
  if (!current) return null;
  const db = commandDatabase();
  if (update.isDefault === true) {
    await db.prepare("UPDATE calendar_sources SET is_default = 0").run();
  }
  await db
    .prepare(
      `UPDATE calendar_sources
       SET visible = ?, include_in_availability = ?, include_in_atlas = ?,
           is_default = ?
       WHERE id = ?`,
    )
    .bind(
      (update.visible ?? current.visible) ? 1 : 0,
      (update.includeInAvailability ?? current.includeInAvailability) ? 1 : 0,
      (update.includeInAtlas ?? current.includeInAtlas) ? 1 : 0,
      (update.isDefault ?? current.isDefault) ? 1 : 0,
      id,
    )
    .run();
  return getCalendarSource(id);
}

export async function getCalendarPrivacySettings() {
  await ensureCalendarIntelligenceSchema();
  const row = await commandDatabase()
    .prepare("SELECT * FROM calendar_privacy_settings WHERE id = 'default'")
    .first<PrivacyRow>();
  if (!row) throw new Error("Calendar privacy settings are unavailable.");
  return {
    sensitiveEventsInAtlas: Boolean(row.sensitive_events_in_atlas),
    patternInsights: Boolean(row.pattern_insights),
    semanticSearch: Boolean(row.semantic_search),
    immediateCreateWithUndo: Boolean(row.immediate_create_with_undo),
    disconnectedDataRetention: row.disconnected_data_retention,
    updatedAt: row.updated_at,
  } satisfies CalendarPrivacySettings;
}

export async function updateCalendarPrivacySettings(
  settings: Omit<CalendarPrivacySettings, "updatedAt">,
) {
  await ensureCalendarIntelligenceSchema();
  const now = new Date().toISOString();
  await commandDatabase()
    .prepare(
      `UPDATE calendar_privacy_settings
       SET sensitive_events_in_atlas = ?, pattern_insights = ?,
           semantic_search = ?, immediate_create_with_undo = ?,
           disconnected_data_retention = ?, updated_at = ?
       WHERE id = 'default'`,
    )
    .bind(
      settings.sensitiveEventsInAtlas ? 1 : 0,
      settings.patternInsights ? 1 : 0,
      settings.semanticSearch ? 1 : 0,
      settings.immediateCreateWithUndo ? 1 : 0,
      settings.disconnectedDataRetention,
      now,
    )
    .run();
  return getCalendarPrivacySettings();
}

export async function listSyncConflicts() {
  await ensureCalendarIntelligenceSchema();
  const rows = await commandDatabase()
    .prepare(
      `SELECT * FROM calendar_sync_conflicts
       WHERE status = 'open'
       ORDER BY created_at DESC LIMIT 100`,
    )
    .all<ConflictRow>();
  return rows.results.map(conflictFromRow);
}

export async function getSyncConflict(id: string) {
  await ensureCalendarIntelligenceSchema();
  const row = await commandDatabase()
    .prepare("SELECT * FROM calendar_sync_conflicts WHERE id = ?")
    .bind(id)
    .first<ConflictRow>();
  return row ? conflictFromRow(row) : null;
}

export async function recordSyncConflict(input: {
  linkId: string;
  localEventId: string;
  sourceId: string;
  differingFields: string[];
  localVersion: Partial<CalendarEventInput>;
  providerVersion: Partial<CalendarEventInput>;
}) {
  await ensureCalendarIntelligenceSchema();
  const existing = await commandDatabase()
    .prepare(
      `SELECT id FROM calendar_sync_conflicts
       WHERE link_id = ? AND status = 'open'`,
    )
    .bind(input.linkId)
    .first<{ id: string }>();
  const id = existing?.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  await commandDatabase()
    .prepare(
      `INSERT INTO calendar_sync_conflicts
       (id, link_id, local_event_id, source_id, differing_fields_json,
        local_json, provider_json, status, created_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, NULL)
       ON CONFLICT(id) DO UPDATE SET
         differing_fields_json = excluded.differing_fields_json,
         local_json = excluded.local_json,
         provider_json = excluded.provider_json,
         created_at = excluded.created_at`,
    )
    .bind(
      id,
      input.linkId,
      input.localEventId,
      input.sourceId,
      JSON.stringify(input.differingFields),
      JSON.stringify(input.localVersion),
      JSON.stringify(input.providerVersion),
      now,
    )
    .run();
  return id;
}

export async function resolveSyncConflict(
  id: string,
  resolution: "nexus" | "provider" | "merged",
) {
  await ensureCalendarIntelligenceSchema();
  const now = new Date().toISOString();
  await commandDatabase()
    .prepare(
      `UPDATE calendar_sync_conflicts
       SET status = ?, resolved_at = ?
       WHERE id = ? AND status = 'open'`,
    )
    .bind(`resolved-${resolution}`, now, id)
    .run();
}

export async function listCalendarAudit(limit = 40) {
  await ensureCalendarIntelligenceSchema();
  const rows = await commandDatabase()
    .prepare(
      `SELECT * FROM calendar_audit
       ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(Math.min(Math.max(limit, 1), 100))
    .all<AuditRow>();
  return rows.results.map(auditFromRow);
}

export async function recordCalendarAudit(input: {
  actor: CalendarAuditEntry["actor"];
  action: string;
  source: string;
  eventIds: string[];
  summary: string;
  providerResult?: SyncOperationState | null;
  proposalId?: string | null;
  undoAvailable?: boolean;
  before?: unknown[];
  after?: unknown[];
}) {
  await ensureCalendarIntelligenceSchema();
  const id = crypto.randomUUID();
  await commandDatabase()
    .prepare(
      `INSERT INTO calendar_audit
       (id, actor, action, source, event_ids_json, summary, provider_result,
        proposal_id, undo_available, before_json, after_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.actor,
      input.action,
      input.source,
      JSON.stringify(input.eventIds),
      input.summary,
      input.providerResult ?? null,
      input.proposalId ?? null,
      input.undoAvailable ? 1 : 0,
      JSON.stringify(input.before ?? []),
      JSON.stringify(input.after ?? []),
      new Date().toISOString(),
    )
    .run();
  return id;
}

export async function getCalendarAuditDetail(id: string) {
  await ensureCalendarIntelligenceSchema();
  const row = await commandDatabase()
    .prepare("SELECT * FROM calendar_audit WHERE id = ?")
    .bind(id)
    .first<AuditRow>();
  return row
    ? {
        entry: auditFromRow(row),
        before: parseJson<CalendarEventInput[]>(row.before_json, []),
        after: parseJson<CalendarEventInput[]>(row.after_json, []),
      }
    : null;
}

export async function markCalendarAuditUndone(id: string) {
  await ensureCalendarIntelligenceSchema();
  await commandDatabase()
    .prepare("UPDATE calendar_audit SET undo_available = 0 WHERE id = ?")
    .bind(id)
    .run();
}

export async function saveCalendarProposal(proposal: CalendarProposal) {
  await ensureCalendarIntelligenceSchema();
  const now = new Date().toISOString();
  await commandDatabase()
    .prepare(
      `INSERT INTO calendar_proposals
       (id, proposal_json, status, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         proposal_json = excluded.proposal_json,
         status = excluded.status,
         expires_at = excluded.expires_at,
         updated_at = excluded.updated_at`,
    )
    .bind(
      proposal.id,
      JSON.stringify(proposal),
      proposal.status,
      proposal.expiresAt,
      proposal.createdAt,
      now,
    )
    .run();
  return proposal;
}

export async function getCalendarProposal(id: string) {
  await ensureCalendarIntelligenceSchema();
  const row = await commandDatabase()
    .prepare("SELECT proposal_json FROM calendar_proposals WHERE id = ?")
    .bind(id)
    .first<{ proposal_json: string }>();
  return row
    ? parseJson<CalendarProposal | null>(row.proposal_json, null)
    : null;
}

export async function upsertCalendarConnection(input: {
  provider: CalendarProvider;
  accountId: string;
  accountEmail: string;
  displayName: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
  tokenExpiresAt: string | null;
  scopes: string[];
}) {
  await ensureCalendarIntelligenceSchema();
  const existing = await commandDatabase()
    .prepare(
      `SELECT * FROM calendar_connections
       WHERE provider = ? AND account_id = ?`,
    )
    .bind(input.provider, input.accountId)
    .first<ConnectionRow>();
  const id = existing?.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  await commandDatabase()
    .prepare(
      `INSERT INTO calendar_connections
       (id, provider, account_id, account_email, display_name, status,
        encrypted_access_token, encrypted_refresh_token, token_expires_at,
        scopes_json, last_synced_at, last_error, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'healthy', ?, ?, ?, ?, NULL, NULL, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         account_email = excluded.account_email,
         display_name = excluded.display_name,
         status = 'healthy',
         encrypted_access_token = excluded.encrypted_access_token,
         encrypted_refresh_token = COALESCE(
           excluded.encrypted_refresh_token,
           calendar_connections.encrypted_refresh_token
         ),
         token_expires_at = excluded.token_expires_at,
         scopes_json = excluded.scopes_json,
         last_error = NULL,
         updated_at = excluded.updated_at`,
    )
    .bind(
      id,
      input.provider,
      input.accountId,
      input.accountEmail,
      input.displayName,
      input.encryptedAccessToken,
      input.encryptedRefreshToken,
      input.tokenExpiresAt,
      JSON.stringify(input.scopes),
      existing?.created_at ?? now,
      now,
    )
    .run();
  return id;
}

export async function getCalendarConnectionCredential(id: string) {
  await ensureCalendarIntelligenceSchema();
  return commandDatabase()
    .prepare("SELECT * FROM calendar_connections WHERE id = ?")
    .bind(id)
    .first<ConnectionRow>();
}

export async function updateConnectionCredential(
  id: string,
  encryptedAccessToken: string,
  tokenExpiresAt: string,
) {
  await ensureCalendarIntelligenceSchema();
  await commandDatabase()
    .prepare(
      `UPDATE calendar_connections
       SET encrypted_access_token = ?, token_expires_at = ?, status = 'healthy',
           last_error = NULL, updated_at = ?
       WHERE id = ?`,
    )
    .bind(encryptedAccessToken, tokenExpiresAt, new Date().toISOString(), id)
    .run();
}

export async function updateConnectionHealth(
  id: string,
  status: CalendarConnection["status"],
  error: string | null,
  syncedAt?: string | null,
) {
  await ensureCalendarIntelligenceSchema();
  const now = new Date().toISOString();
  await commandDatabase()
    .prepare(
      `UPDATE calendar_connections
       SET status = ?, last_error = ?,
           last_synced_at = COALESCE(?, last_synced_at), updated_at = ?
       WHERE id = ?`,
    )
    .bind(status, error, syncedAt ?? null, now, id)
    .run();
}

export async function upsertExternalCalendarSource(input: {
  connectionId: string;
  provider: CalendarProvider;
  externalCalendarId: string;
  displayName: string;
  access: CalendarSource["access"];
  visible: boolean;
  includeInAvailability: boolean;
  includeInAtlas: boolean;
  isDefault: boolean;
}) {
  await ensureCalendarIntelligenceSchema();
  const current = await commandDatabase()
    .prepare(
      `SELECT * FROM calendar_sources
       WHERE provider = ? AND connection_id = ? AND external_calendar_id = ?`,
    )
    .bind(input.provider, input.connectionId, input.externalCalendarId)
    .first<SourceRow>();
  const id = current?.id ?? crypto.randomUUID();
  await commandDatabase()
    .prepare(
      `INSERT INTO calendar_sources
       (id, connection_id, provider, external_calendar_id, display_name,
        access, visible, include_in_availability, include_in_atlas, is_default,
        sync_status, sync_cursor, last_synced_at, color_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'healthy', NULL, NULL, 'green')
       ON CONFLICT(id) DO UPDATE SET
         display_name = excluded.display_name,
         access = excluded.access,
         sync_status = 'healthy'`,
    )
    .bind(
      id,
      input.connectionId,
      input.provider,
      input.externalCalendarId,
      input.displayName,
      input.access,
      input.visible ? 1 : 0,
      input.includeInAvailability ? 1 : 0,
      input.includeInAtlas ? 1 : 0,
      input.isDefault ? 1 : 0,
    )
    .run();
  return id;
}

export async function updateSourceSyncState(
  id: string,
  status: CalendarSource["syncStatus"],
  cursor: string | null,
  syncedAt: string | null,
) {
  await ensureCalendarIntelligenceSchema();
  await commandDatabase()
    .prepare(
      `UPDATE calendar_sources
       SET sync_status = ?, sync_cursor = ?, last_synced_at = ?
       WHERE id = ?`,
    )
    .bind(status, cursor, syncedAt, id)
    .run();
}

export async function getSourceSyncCursor(id: string) {
  await ensureCalendarIntelligenceSchema();
  const row = await commandDatabase()
    .prepare("SELECT sync_cursor FROM calendar_sources WHERE id = ?")
    .bind(id)
    .first<{ sync_cursor: string | null }>();
  return row?.sync_cursor ?? null;
}

export async function getExternalEventLinkByExternal(
  sourceId: string,
  externalEventId: string,
) {
  await ensureCalendarIntelligenceSchema();
  return commandDatabase()
    .prepare(
      `SELECT * FROM external_event_links
       WHERE source_id = ? AND external_event_id = ?`,
    )
    .bind(sourceId, externalEventId)
    .first<LinkRow>();
}

export async function getExternalEventLinkByLocal(localEventId: string) {
  await ensureCalendarIntelligenceSchema();
  return commandDatabase()
    .prepare("SELECT * FROM external_event_links WHERE local_event_id = ?")
    .bind(localEventId)
    .first<LinkRow>();
}

export async function getExternalEventLinkById(id: string) {
  await ensureCalendarIntelligenceSchema();
  return commandDatabase()
    .prepare("SELECT * FROM external_event_links WHERE id = ?")
    .bind(id)
    .first<LinkRow>();
}

export async function upsertExternalEventLink(input: {
  id?: string;
  sourceId: string;
  localEventId: string;
  externalEventId: string;
  externalSeriesId: string | null;
  providerVersion: string | null;
  lastSyncedHash: string | null;
  lastLocalVersion: number;
  direction: "pull" | "push";
  pendingAction?: string | null;
}) {
  await ensureCalendarIntelligenceSchema();
  const current = await getExternalEventLinkByExternal(
    input.sourceId,
    input.externalEventId,
  );
  const id = current?.id ?? input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  await commandDatabase()
    .prepare(
      `INSERT INTO external_event_links
       (id, source_id, local_event_id, external_event_id, external_series_id,
        provider_version, last_pulled_at, last_pushed_at, last_synced_hash,
        last_local_version, pending_action, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         local_event_id = excluded.local_event_id,
         external_series_id = excluded.external_series_id,
         provider_version = excluded.provider_version,
         last_pulled_at = COALESCE(excluded.last_pulled_at, last_pulled_at),
         last_pushed_at = COALESCE(excluded.last_pushed_at, last_pushed_at),
         last_synced_hash = excluded.last_synced_hash,
         last_local_version = excluded.last_local_version,
         pending_action = excluded.pending_action,
         updated_at = excluded.updated_at`,
    )
    .bind(
      id,
      input.sourceId,
      input.localEventId,
      input.externalEventId,
      input.externalSeriesId,
      input.providerVersion,
      input.direction === "pull" ? now : null,
      input.direction === "push" ? now : null,
      input.lastSyncedHash,
      input.lastLocalVersion,
      input.pendingAction ?? null,
      current?.created_at ?? now,
      now,
    )
    .run();
  return id;
}

export async function markExternalLinkPending(
  localEventId: string,
  action: "update" | "delete" | null,
) {
  await ensureCalendarIntelligenceSchema();
  await commandDatabase()
    .prepare(
      `UPDATE external_event_links
       SET pending_action = ?, updated_at = ?
       WHERE local_event_id = ?`,
    )
    .bind(action, new Date().toISOString(), localEventId)
    .run();
}

export async function setInsightPreference(
  insightKey: string,
  update: { dismissed?: boolean; muted?: boolean },
) {
  await ensureCalendarIntelligenceSchema();
  const current = await commandDatabase()
    .prepare(
      `SELECT dismissed, muted FROM calendar_insight_preferences
       WHERE insight_key = ?`,
    )
    .bind(insightKey)
    .first<{ dismissed: number; muted: number }>();
  await commandDatabase()
    .prepare(
      `INSERT INTO calendar_insight_preferences
       (insight_key, dismissed, muted, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(insight_key) DO UPDATE SET
         dismissed = excluded.dismissed,
         muted = excluded.muted,
         updated_at = excluded.updated_at`,
    )
    .bind(
      insightKey,
      (update.dismissed ?? Boolean(current?.dismissed)) ? 1 : 0,
      (update.muted ?? Boolean(current?.muted)) ? 1 : 0,
      new Date().toISOString(),
    )
    .run();
}

export async function applyInsightPreferences(insights: PatternInsight[]) {
  await ensureCalendarIntelligenceSchema();
  const rows = await commandDatabase()
    .prepare("SELECT * FROM calendar_insight_preferences")
    .all<{ insight_key: string; dismissed: number; muted: number }>();
  const preferences = new Map(
    rows.results.map((row) => [
      row.insight_key,
      { dismissed: Boolean(row.dismissed), muted: Boolean(row.muted) },
    ]),
  );
  return insights
    .map((insight) => ({ ...insight, ...(preferences.get(insight.id) ?? {}) }))
    .filter((insight) => !insight.muted);
}

export async function disconnectCalendarConnection(
  id: string,
  retention: "remove" | "snapshot",
) {
  await ensureCalendarIntelligenceSchema();
  const db = commandDatabase();
  const now = new Date().toISOString();
  const sources = await db
    .prepare("SELECT id FROM calendar_sources WHERE connection_id = ?")
    .bind(id)
    .all<{ id: string }>();
  for (const source of sources.results) {
    if (retention === "remove") {
      await db.batch([
        db
          .prepare(
            `UPDATE timeline_items
             SET deleted_at = ?, updated_at = ?
             WHERE source_id = ? AND source = 'imported'`,
          )
          .bind(now, now, source.id),
        db
          .prepare("DELETE FROM external_event_links WHERE source_id = ?")
          .bind(source.id),
      ]);
    } else {
      await db
        .prepare(
          `UPDATE timeline_items
           SET read_only = 1, last_synced_at = ?, updated_at = ?
           WHERE source_id = ? AND source = 'imported'`,
        )
        .bind(now, now, source.id)
        .run();
      await db
        .prepare("DELETE FROM external_event_links WHERE source_id = ?")
        .bind(source.id)
        .run();
    }
  }
  await db.batch([
    db
      .prepare(
        `UPDATE calendar_sources
         SET sync_status = 'disconnected'
         WHERE connection_id = ?`,
      )
      .bind(id),
    db
      .prepare(
        `UPDATE calendar_connections
         SET status = 'disconnected', encrypted_access_token = '',
             encrypted_refresh_token = NULL, token_expires_at = NULL,
             updated_at = ?
         WHERE id = ?`,
      )
      .bind(now, id),
  ]);
}
