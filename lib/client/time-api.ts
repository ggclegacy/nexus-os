import type { Priority, PriorityInput, PriorityUpdate } from "../domain/types";
import type {
  CalendarEvent,
  CalendarEventInput,
  CalendarFilters,
  CalendarPayload,
  RecurrenceEditScope,
  ReminderInstance,
  Routine,
  RoutineInput,
  RoutineOccurrence,
  TimePreferences,
} from "../time/types";

export class ApiConflictError extends Error {
  conflicts: Array<{
    id: string;
    title: string;
    startAt: string | null;
    endAt: string | null;
  }>;

  constructor(message: string, conflicts: ApiConflictError["conflicts"] = []) {
    super(message);
    this.name = "ApiConflictError";
    this.conflicts = conflicts;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const idempotencyKey =
    init?.method === "POST" ? crypto.randomUUID() : undefined;
  const requestInit: RequestInit = {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      ...init?.headers,
    },
  };
  let response: Response;
  try {
    response = await fetch(url, requestInit);
  } catch (error) {
    if (!idempotencyKey) throw error;
    response = await fetch(url, requestInit);
  }
  const payload = (await response.json()) as T & {
    error?: string;
    conflicts?: ApiConflictError["conflicts"];
  };
  if (!response.ok) {
    if (response.status === 409 && payload.conflicts?.length) {
      throw new ApiConflictError(
        payload.error ?? "This change overlaps another commitment.",
        payload.conflicts,
      );
    }
    throw new Error(payload.error ?? "The request could not be completed.");
  }
  return payload;
}

function filterParams(filters: CalendarFilters) {
  return new URLSearchParams({
    query: filters.query,
    events: String(filters.includeEvents),
    priorities: String(filters.includePriorities),
    routines: String(filters.includeRoutines),
    completed: String(filters.includeCompleted),
    types: filters.eventTypes.join(","),
    statuses: filters.statuses.join(","),
    importance: filters.priorities.join(","),
    payment: filters.payment,
    recurrence: filters.recurrence,
  });
}

export const timeApi = {
  async load(
    start: string,
    end: string,
    filters: CalendarFilters,
    signal?: AbortSignal,
    timeZone?: string,
  ) {
    const params = filterParams(filters);
    params.set("start", start);
    params.set("end", end);
    if (timeZone) params.set("timeZone", timeZone);
    return request<CalendarPayload>(`/api/time?${params}`, { signal });
  },

  async createEvent(event: CalendarEventInput, acknowledgeConflict = false) {
    const result = await request<{ event: CalendarEvent }>("/api/events", {
      method: "POST",
      body: JSON.stringify({ event, acknowledgeConflict }),
    });
    return result.event;
  },

  async updateEvent(
    id: string,
    occurrenceDate: string,
    scope: RecurrenceEditScope,
    event: CalendarEventInput,
    acknowledgeConflict = false,
  ) {
    const result = await request<{ event: CalendarEvent }>(
      `/api/events/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          event,
          occurrenceDate,
          scope,
          acknowledgeConflict,
        }),
      },
    );
    return result.event;
  },

  async deleteEvent(
    id: string,
    occurrenceDate: string,
    scope: RecurrenceEditScope,
  ) {
    await request(`/api/events/${encodeURIComponent(id)}`, {
      method: "DELETE",
      body: JSON.stringify({ occurrenceDate, scope }),
    });
  },

  async createPriority(input: PriorityInput) {
    const result = await request<{ priority: Priority }>("/api/priorities", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return result.priority;
  },

  async updatePriority(id: string, input: PriorityUpdate) {
    const result = await request<{ priority: Priority }>(
      `/api/priorities/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(input) },
    );
    return result.priority;
  },

  async deletePriority(id: string) {
    await request(`/api/priorities/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async reorderPriorities(ids: string[]) {
    const result = await request<{ priorities: Priority[] }>(
      "/api/priorities/reorder",
      { method: "PATCH", body: JSON.stringify({ ids }) },
    );
    return result.priorities;
  },

  async createRoutine(input: RoutineInput) {
    const result = await request<{ routine: Routine }>("/api/routines", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return result.routine;
  },

  async updateRoutine(id: string, input: RoutineInput) {
    const result = await request<{ routine: Routine }>(
      `/api/routines/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(input) },
    );
    return result.routine;
  },

  async archiveRoutine(id: string) {
    await request(`/api/routines/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async updateOccurrence(
    routineId: string,
    scheduledDate: string,
    status: "upcoming" | "due" | "completed" | "skipped",
    note = "",
  ) {
    const result = await request<{ occurrence: RoutineOccurrence }>(
      `/api/routines/${encodeURIComponent(routineId)}/occurrences/${scheduledDate}`,
      { method: "PATCH", body: JSON.stringify({ status, note }) },
    );
    return result.occurrence;
  },

  async updatePreferences(input: TimePreferences) {
    const result = await request<{ preferences: TimePreferences }>(
      "/api/time/preferences",
      { method: "PATCH", body: JSON.stringify(input) },
    );
    return result.preferences;
  },

  async updateReminder(
    id: string,
    action: "seen" | "snooze" | "resolve" | "dismiss",
    snoozedUntil?: string,
  ) {
    const result = await request<{ reminder: ReminderInstance }>(
      `/api/reminders/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ action, snoozedUntil }),
      },
    );
    return result.reminder;
  },
};

export type TimeApi = typeof timeApi;
