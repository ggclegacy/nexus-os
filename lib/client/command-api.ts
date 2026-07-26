import type {
  CommandData,
  Priority,
  PriorityInput,
  PriorityUpdate,
  TimelineInput,
  TimelineItem,
  TimelineUpdate,
} from "../domain/types";

export interface CommandApi {
  load(
    date: string,
    timeZone: string,
    signal?: AbortSignal,
  ): Promise<CommandData>;
  createPriority(input: PriorityInput): Promise<Priority>;
  updatePriority(id: string, update: PriorityUpdate): Promise<Priority>;
  deletePriority(id: string): Promise<Priority>;
  reorderPriorities(ids: string[]): Promise<Priority[]>;
  createTimeline(input: TimelineInput): Promise<TimelineItem>;
  updateTimeline(id: string, update: TimelineUpdate): Promise<TimelineItem>;
  deleteTimeline(id: string): Promise<TimelineItem>;
  createCapture(content: string): Promise<void>;
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
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "The request could not be completed.");
  }
  return payload;
}

export const browserCommandApi: CommandApi = {
  async load(date, timeZone, signal) {
    return request<CommandData>(
      `/api/command?date=${encodeURIComponent(date)}&timeZone=${encodeURIComponent(timeZone)}`,
      { signal },
    );
  },
  async createPriority(input) {
    const result = await request<{ priority: Priority }>("/api/priorities", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return result.priority;
  },
  async updatePriority(id, update) {
    const result = await request<{ priority: Priority }>(
      `/api/priorities/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(update) },
    );
    return result.priority;
  },
  async deletePriority(id) {
    const result = await request<{ priority: Priority }>(
      `/api/priorities/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    return result.priority;
  },
  async reorderPriorities(ids) {
    const result = await request<{ priorities: Priority[] }>(
      "/api/priorities/reorder",
      { method: "PATCH", body: JSON.stringify({ ids }) },
    );
    return result.priorities;
  },
  async createTimeline(input) {
    const result = await request<{ item: TimelineItem }>("/api/timeline", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return result.item;
  },
  async updateTimeline(id, update) {
    const result = await request<{ item: TimelineItem }>(
      `/api/timeline/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(update) },
    );
    return result.item;
  },
  async deleteTimeline(id) {
    const result = await request<{ item: TimelineItem }>(
      `/api/timeline/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    return result.item;
  },
  async createCapture(content) {
    await request("/api/captures", {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  },
};
