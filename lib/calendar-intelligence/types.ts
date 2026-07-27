import type { CalendarEvent, CalendarEventInput } from "../time/types";

export type CalendarProvider = "google";
export type CalendarAccess = "read" | "write";
export type CalendarSyncStatus =
  "healthy" | "syncing" | "attention" | "disconnected";
export type SyncOperationState =
  "confirmed" | "pending" | "failed" | "conflict";

export interface CalendarConnection {
  id: string;
  provider: CalendarProvider;
  accountId: string;
  accountEmail: string;
  displayName: string;
  status: CalendarSyncStatus;
  scopes: string[];
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarSource {
  id: string;
  connectionId: string | null;
  provider: "nexus" | CalendarProvider | "module";
  externalCalendarId: string | null;
  displayName: string;
  access: CalendarAccess;
  visible: boolean;
  includeInAvailability: boolean;
  includeInAtlas: boolean;
  isDefault: boolean;
  syncStatus: CalendarSyncStatus;
  lastSyncedAt: string | null;
  colorKey: "gold" | "green" | "stone";
}

export interface SyncConflict {
  id: string;
  linkId: string;
  localEventId: string;
  sourceId: string;
  differingFields: string[];
  localVersion: Partial<CalendarEventInput>;
  providerVersion: Partial<CalendarEventInput>;
  status: "open" | "resolved-nexus" | "resolved-provider" | "resolved-merged";
  createdAt: string;
  resolvedAt: string | null;
}

export interface CalendarPrivacySettings {
  sensitiveEventsInAtlas: boolean;
  patternInsights: boolean;
  semanticSearch: boolean;
  immediateCreateWithUndo: boolean;
  disconnectedDataRetention: "remove" | "snapshot";
  updatedAt: string;
}

export interface CalendarAuditEntry {
  id: string;
  actor: "owner" | "atlas" | "provider" | "system";
  action: string;
  source: string;
  eventIds: string[];
  summary: string;
  providerResult: SyncOperationState | null;
  proposalId: string | null;
  undoAvailable: boolean;
  createdAt: string;
}

export interface PatternInsight {
  id: string;
  kind:
    | "rescheduled"
    | "conflict"
    | "missing-buffer"
    | "missed-reminder"
    | "late-bill"
    | "overloaded";
  observation: string;
  evidence: string;
  dateRange: string;
  suggestion: string;
  dismissed: boolean;
  muted: boolean;
}

export interface CalendarCapabilities {
  google: {
    configured: boolean;
    reasonUnavailable: string | null;
  };
  atlas: {
    configured: boolean;
    model: string | null;
    reasonUnavailable: string | null;
  };
  reconciliation: "manual";
  weather: false;
  travelTime: false;
  attachments: false;
  connectedModules: [];
}

export interface CalendarIntelligencePayload {
  capabilities: CalendarCapabilities;
  connections: CalendarConnection[];
  sources: CalendarSource[];
  conflicts: SyncConflict[];
  privacy: CalendarPrivacySettings;
  audit: CalendarAuditEntry[];
  insights: PatternInsight[];
}

export interface CapturePreview {
  id: string;
  request: string;
  summary: string;
  event: CalendarEventInput;
  destinationSourceId: string | null;
  inferredFields: string[];
  assumptions: string[];
  ambiguities: string[];
  conflicts: Array<{
    id: string;
    title: string;
    startAt: string | null;
    endAt: string | null;
  }>;
  engine: "atlas" | "deterministic";
  expiresAt: string;
}

export interface AtlasFact {
  eventId: string;
  occurrenceKey: string;
  label: string;
  localDate: string;
}

export interface AtlasAnswer {
  answer: string;
  interpretation: string;
  facts: AtlasFact[];
  suggestions: string[];
  engine: "atlas" | "deterministic";
}

export interface AvailabilityRequest {
  durationMinutes: number;
  startDate: string;
  endDate: string;
  preferredPeriod: "any" | "morning" | "afternoon" | "evening";
}

export interface AvailabilitySlot {
  startAt: string;
  endAt: string;
  localDate: string;
  startTime: string;
  endTime: string;
  reason: string;
  nearby: Array<Pick<CalendarEvent, "id" | "title" | "startAt" | "endAt">>;
  softPreferenceViolated: boolean;
}

export type CalendarOperation =
  | {
      id: string;
      type: "create-event";
      event: CalendarEventInput;
      destinationSourceId: string | null;
      reason: string;
    }
  | {
      id: string;
      type: "move-event";
      eventId: string;
      occurrenceDate: string;
      before: CalendarEventInput;
      after: CalendarEventInput;
      reason: string;
    };

export interface CalendarProposal {
  id: string;
  userRequest: string;
  summary: string;
  operations: CalendarOperation[];
  assumptions: string[];
  conflicts: CapturePreview["conflicts"];
  status:
    | "draft"
    | "approved"
    | "applying"
    | "applied"
    | "partially-applied"
    | "rejected";
  expiresAt: string;
  createdAt: string;
}

export interface ProposalResult {
  proposal: CalendarProposal;
  events: CalendarEvent[];
  auditId: string;
  undoUntil: string | null;
}
