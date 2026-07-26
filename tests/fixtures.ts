import type {
  CommandData,
  Priority,
  PriorityInput,
  PriorityUpdate,
  TimelineInput,
  TimelineItem,
  TimelineUpdate,
} from "../lib/domain/types";
import type { CommandApi } from "../lib/client/command-api";
import { buildAlerts, buildDailyBriefing } from "../lib/domain/briefing";

const now = "2026-07-26T14:00:00.000Z";

export function commandData(
  priorities: Priority[] = [],
  timeline: TimelineItem[] = [],
): CommandData {
  const alerts = buildAlerts(priorities, timeline, new Date(now));
  return {
    date: "2026-07-26",
    timeZone: "America/Chicago",
    sourceLabel: "Private local workspace",
    lastUpdatedAt: new Date().toISOString(),
    priorities: {
      state: priorities.length ? "loaded" : "empty",
      data: priorities,
    },
    timeline: {
      state: timeline.length ? "loaded" : "empty",
      data: timeline,
    },
    protocol: {
      state: "empty",
      data: {
        configured: false,
        dueNow: 0,
        upcoming: 0,
        completedToday: 0,
      },
    },
    performance: {
      state: "unavailable",
      data: {
        workoutPlanned: null,
        lastWorkout: null,
        sleepDurationMinutes: null,
        sleepQuality: null,
        recovery: null,
      },
    },
    alerts: {
      state: alerts.length ? "loaded" : "empty",
      data: alerts,
    },
    briefing: {
      state: "loaded",
      data: buildDailyBriefing(priorities, timeline, alerts, new Date(now)),
    },
    atlasAvailable: false,
  };
}

export class FakeCommandApi implements CommandApi {
  priorities: Priority[] = [];
  timeline: TimelineItem[] = [];
  failLoad = false;

  async load() {
    if (this.failLoad) throw new Error("Simulated Command failure.");
    return commandData([...this.priorities], [...this.timeline]);
  }

  async createPriority(input: PriorityInput) {
    const timestamp = new Date().toISOString();
    const priority: Priority = {
      id: `priority-${this.priorities.length + 1}`,
      title: input.title,
      dueAt: input.dueAt ?? null,
      status: "active",
      position: this.priorities.filter((item) => item.status === "active")
        .length,
      source: "local",
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
    };
    this.priorities = [...this.priorities, priority];
    return priority;
  }

  async updatePriority(id: string, update: PriorityUpdate) {
    const index = this.priorities.findIndex((item) => item.id === id);
    const current = this.priorities[index];
    if (!current) throw new Error("Priority not found.");
    const next = {
      ...current,
      ...update,
      dueAt: update.dueAt === undefined ? current.dueAt : update.dueAt,
      completedAt:
        update.status === "completed"
          ? new Date().toISOString()
          : update.status === "active"
            ? null
            : current.completedAt,
      updatedAt: new Date().toISOString(),
    };
    this.priorities[index] = next;
    return next;
  }

  async deletePriority(id: string) {
    const index = this.priorities.findIndex((item) => item.id === id);
    const [deleted] = this.priorities.splice(index, 1);
    return deleted;
  }

  async reorderPriorities(ids: string[]) {
    this.priorities = this.priorities.map((item) => ({
      ...item,
      position: ids.includes(item.id) ? ids.indexOf(item.id) : item.position,
    }));
    return this.priorities;
  }

  async createTimeline(input: TimelineInput) {
    const timestamp = new Date().toISOString();
    const item: TimelineItem = {
      id: `timeline-${this.timeline.length + 1}`,
      title: input.title,
      kind: input.kind,
      status: "scheduled",
      startAt: input.startAt ?? null,
      endAt: input.endAt ?? null,
      localDate: input.localDate,
      timeZone: input.timeZone,
      notes: input.notes ?? "",
      source: "local",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.timeline = [...this.timeline, item];
    return item;
  }

  async updateTimeline(id: string, update: TimelineUpdate) {
    const index = this.timeline.findIndex((item) => item.id === id);
    const current = this.timeline[index];
    if (!current) throw new Error("Timeline item not found.");
    const next = {
      ...current,
      ...update,
      updatedAt: new Date().toISOString(),
    };
    this.timeline[index] = next;
    return next;
  }

  async deleteTimeline(id: string) {
    const index = this.timeline.findIndex((item) => item.id === id);
    const [deleted] = this.timeline.splice(index, 1);
    return deleted;
  }

  async createCapture() {}
}
