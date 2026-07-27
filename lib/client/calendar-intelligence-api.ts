import type {
  AtlasAnswer,
  AvailabilityRequest,
  AvailabilitySlot,
  CalendarIntelligencePayload,
  CalendarPrivacySettings,
  CalendarProposal,
  CalendarSource,
  CapturePreview,
  ProposalResult,
} from "../calendar-intelligence/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(
      payload.error ?? "The Calendar request could not be completed.",
    );
  }
  return payload;
}

export const calendarIntelligenceApi = {
  load() {
    return request<CalendarIntelligencePayload>("/api/calendar/intelligence");
  },

  async updatePrivacy(privacy: Omit<CalendarPrivacySettings, "updatedAt">) {
    const result = await request<{ privacy: CalendarPrivacySettings }>(
      "/api/calendar/intelligence",
      { method: "PATCH", body: JSON.stringify(privacy) },
    );
    return result.privacy;
  },

  async updateSource(
    id: string,
    update: Partial<
      Pick<
        CalendarSource,
        "visible" | "includeInAvailability" | "includeInAtlas" | "isDefault"
      >
    >,
  ) {
    const result = await request<{ source: CalendarSource }>(
      `/api/calendar/sources/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(update) },
    );
    return result.source;
  },

  sync(connectionId: string) {
    return request<{ results: Array<{ sourceId: string; syncedAt: string }> }>(
      "/api/calendar/sync",
      { method: "POST", body: JSON.stringify({ connectionId }) },
    );
  },

  disconnect(connectionId: string, retention: "remove" | "snapshot") {
    return request<{ disconnected: true }>(
      `/api/calendar/connections/${encodeURIComponent(connectionId)}`,
      { method: "DELETE", body: JSON.stringify({ retention }) },
    );
  },

  capture(text: string, destinationSourceId?: string) {
    return request<{ preview: CapturePreview; proposal: CalendarProposal }>(
      "/api/calendar/atlas/capture",
      {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ request: text, destinationSourceId }),
      },
    );
  },

  async ask(query: string) {
    const result = await request<{ answer: AtlasAnswer }>(
      "/api/calendar/atlas/ask",
      { method: "POST", body: JSON.stringify({ query }) },
    );
    return result.answer;
  },

  availability(input: AvailabilityRequest) {
    return request<{ request: AvailabilityRequest; slots: AvailabilitySlot[] }>(
      "/api/calendar/atlas/availability",
      { method: "POST", body: JSON.stringify(input) },
    );
  },

  async plan(date: string) {
    const result = await request<{ proposal: CalendarProposal }>(
      "/api/calendar/atlas/plan",
      {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ date }),
      },
    );
    return result.proposal;
  },

  applyProposal(
    id: string,
    approvedOperationIds: string[],
    acknowledgeConflicts = false,
  ) {
    return request<ProposalResult>(
      `/api/calendar/proposals/${encodeURIComponent(id)}`,
      {
        method: "POST",
        body: JSON.stringify({
          approvedOperationIds,
          acknowledgeConflicts,
        }),
      },
    );
  },

  rejectProposal(id: string) {
    return request<{ proposal: CalendarProposal }>(
      `/api/calendar/proposals/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify({ action: "reject" }) },
    );
  },

  editProposal(
    id: string,
    operationId: string,
    event: unknown,
    destinationSourceId?: string | null,
  ) {
    return request<{ proposal: CalendarProposal }>(
      `/api/calendar/proposals/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          action: "edit",
          operationId,
          event,
          destinationSourceId,
        }),
      },
    );
  },

  resolveConflict(
    id: string,
    resolution: "nexus" | "provider" | "merged",
    event?: unknown,
  ) {
    return request(`/api/calendar/conflicts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ resolution, event }),
    });
  },

  updateInsight(id: string, action: "dismiss" | "mute") {
    return request(`/api/calendar/insights/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    });
  },

  undoAudit(id: string) {
    return request<{ undone: true }>(
      `/api/calendar/audit/${encodeURIComponent(id)}/undo`,
      { method: "POST", body: "{}" },
    );
  },
};

export type CalendarIntelligenceApi = typeof calendarIntelligenceApi;
