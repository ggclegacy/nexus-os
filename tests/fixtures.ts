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
import { ApiConflictError, type TimeApi } from "../lib/client/time-api";
import { buildAlerts, buildDailyBriefing } from "../lib/domain/briefing";
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
} from "../lib/time/types";

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
    return commandData(
      this.priorities.filter((item) => !item.archivedAt),
      [...this.timeline],
    );
  }

  async createPriority(input: PriorityInput) {
    if (
      input.isTop !== false &&
      this.priorities.filter(
        (item) => item.status === "active" && item.isTop !== false,
      ).length >= 3
    ) {
      throw new Error("Only three active priorities can be in the top three.");
    }
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
      archivedAt:
        update.archived === undefined
          ? current.archivedAt
          : update.archived
            ? new Date().toISOString()
            : null,
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
    const priority = this.priorities.find((item) => item.id === id);
    if (!priority) throw new Error("Priority not found.");
    priority.archivedAt = new Date().toISOString();
    return priority;
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

export class FakeTimeApi implements TimeApi {
  events: CalendarEvent[] = [];
  priorities: Priority[] = [];
  routines: Routine[] = [];
  occurrences: RoutineOccurrence[] = [];
  reminderInstances: ReminderInstance[] = [];
  preferences: TimePreferences = {
    timeZone: "America/Chicago",
    locale: "en-US",
    weekStartsOn: 1,
    hourCycle: "12",
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    quietBehavior: "delay",
    notificationPermission: "in-app-only",
    defaultView: "day",
    defaultEventDurationMinutes: 60,
    transitionBufferMinutes: 15,
    morningBriefTime: "07:00",
    eveningBriefTime: "20:00",
    escalationEnabled: true,
    defaultSnoozeMinutes: 60,
    overloadMinutesPerDay: 480,
    overloadImportantItemCount: 5,
    updatedAt: now,
  };
  failLoad = false;
  conflictOnCreate = false;
  lastEventScope: RecurrenceEditScope | null = null;

  async load(
    start: string,
    end: string,
    filters: CalendarFilters,
  ): Promise<CalendarPayload> {
    if (this.failLoad) throw new Error("Simulated Calendar failure.");
    const query = filters.query.toLowerCase();
    return {
      rangeStart: start,
      rangeEnd: end,
      events: filters.includeEvents
        ? this.events.filter((item) => {
            const searchable = [
              item.title,
              item.notes,
              item.location,
              item.provider,
              item.billCategory,
              item.accountNote,
              item.relationship,
              item.giftIdea,
              item.amount === null ? "" : String(item.amount),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return (
              (!query || searchable.includes(query)) &&
              (!filters.eventTypes.length ||
                filters.eventTypes.includes(item.eventType)) &&
              (!filters.statuses.length ||
                filters.statuses.includes(item.status)) &&
              (!filters.priorities.length ||
                filters.priorities.includes(item.priority)) &&
              (filters.includeCompleted ||
                filters.statuses.includes(item.status) ||
                !["completed", "dismissed", "cancelled"].includes(
                  item.status,
                )) &&
              (filters.payment === "all" ||
                item.paymentStatus === filters.payment) &&
              (filters.recurrence === "all" ||
                (filters.recurrence === "recurring"
                  ? item.recurrence !== null
                  : item.recurrence === null))
            );
          })
        : [],
      priorities: filters.includePriorities
        ? this.priorities.filter((item) => !item.archivedAt)
        : [],
      routines: filters.includeRoutines ? [...this.routines] : [],
      occurrences: filters.includeRoutines ? [...this.occurrences] : [],
      reminders: [],
      reminderInstances: [...this.reminderInstances],
      preferences: this.preferences,
      sourceLabel: "Private local workspace",
      lastUpdatedAt: new Date().toISOString(),
      stale: false,
      syncAvailable: false,
    };
  }

  async createEvent(input: CalendarEventInput, acknowledgeConflict = false) {
    if (this.conflictOnCreate && !acknowledgeConflict) {
      throw new ApiConflictError("Review this overlap.", [
        {
          id: "existing-event",
          title: "Existing commitment",
          startAt: "2026-07-26T14:00:00.000Z",
          endAt: "2026-07-26T15:00:00.000Z",
        },
      ]);
    }
    const timestamp = new Date().toISOString();
    const id = `event-${this.events.length + 1}`;
    const event: CalendarEvent = {
      id,
      occurrenceKey: input.recurrence ? `${id}:${input.localDate}` : id,
      occurrenceDate: input.localDate,
      seriesId: input.recurrence ? id : null,
      title: input.title,
      eventType: input.eventType,
      notes: input.notes,
      location: input.location,
      provider: input.provider,
      meetingUrl: input.meetingUrl,
      amount: input.amount,
      currency: input.currency,
      paymentStatus: input.paymentStatus,
      priority: input.priority,
      status: input.status,
      allDay: input.allDay,
      localDate: input.localDate,
      endLocalDate: input.endLocalDate,
      startTime: input.startTime,
      endTime: input.endTime,
      startAt: input.allDay
        ? null
        : `${input.localDate}T${input.startTime}:00.000Z`,
      endAt: input.allDay
        ? null
        : `${input.endLocalDate}T${input.endTime}:00.000Z`,
      timeZone: input.timeZone,
      recurrence: input.recurrence,
      reminderOffsets: input.reminderOffsets,
      source: "local",
      sourceId: null,
      externalCalendarId: null,
      lastSyncedAt: null,
      localVersion: 1,
      remoteVersion: null,
      readOnly: false,
      conflictState: "none",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.events.push(event);
    return event;
  }

  async updateEvent(
    id: string,
    occurrenceDate: string,
    scope: RecurrenceEditScope,
    input: CalendarEventInput,
  ) {
    this.lastEventScope = scope;
    const current = this.events.find(
      (item) => item.id === id && item.occurrenceDate === occurrenceDate,
    );
    if (!current) throw new Error("Event not found.");
    Object.assign(current, input, { updatedAt: new Date().toISOString() });
    return current;
  }

  async deleteEvent(
    id: string,
    _occurrenceDate: string,
    scope: RecurrenceEditScope,
  ) {
    this.lastEventScope = scope;
    this.events = this.events.filter((item) => item.id !== id);
  }

  async createPriority(input: PriorityInput) {
    const timestamp = new Date().toISOString();
    const priority: Priority = {
      id: `priority-${this.priorities.length + 1}`,
      title: input.title,
      notes: input.notes ?? "",
      dueAt: input.dueAt ?? null,
      status: "active",
      position: this.priorities.length,
      isTop: input.isTop ?? true,
      scheduledStartAt: input.scheduledStartAt ?? null,
      scheduledEndAt: input.scheduledEndAt ?? null,
      reminderEnabled: input.reminderEnabled ?? false,
      reminderOffsetMinutes: input.reminderOffsetMinutes ?? null,
      source: "local",
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
    };
    this.priorities.push(priority);
    return priority;
  }

  async updatePriority(id: string, update: PriorityUpdate) {
    const priority = this.priorities.find((item) => item.id === id);
    if (!priority) throw new Error("Priority not found.");
    if (
      update.isTop === true &&
      priority.isTop === false &&
      this.priorities.filter(
        (item) => item.status === "active" && item.isTop !== false,
      ).length >= 3
    ) {
      throw new Error("Only three active priorities can be in the top three.");
    }
    Object.assign(priority, update, { updatedAt: new Date().toISOString() });
    if (update.archived !== undefined) {
      priority.archivedAt = update.archived ? new Date().toISOString() : null;
    }
    return priority;
  }

  async deletePriority(id: string) {
    const priority = this.priorities.find((item) => item.id === id);
    if (!priority) throw new Error("Priority not found.");
    priority.archivedAt = new Date().toISOString();
  }

  async reorderPriorities(ids: string[]) {
    this.priorities.forEach((item) => {
      if (ids.includes(item.id)) item.position = ids.indexOf(item.id);
    });
    return this.priorities;
  }

  async createRoutine(input: RoutineInput) {
    const timestamp = new Date().toISOString();
    const routine: Routine = {
      id: `routine-${this.routines.length + 1}`,
      ...input,
      source: "local",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.routines.push(routine);
    this.occurrences.push({
      id: `occurrence-${routine.id}-${input.startDate}`,
      routineId: routine.id,
      routineName: routine.name,
      scheduledDate: input.startDate,
      scheduledAt: input.preferredTime
        ? `${input.startDate}T${input.preferredTime}:00.000Z`
        : null,
      windowStartAt: input.windowStart
        ? `${input.startDate}T${input.windowStart}:00.000Z`
        : null,
      windowEndAt: input.windowEnd
        ? `${input.startDate}T${input.windowEnd}:00.000Z`
        : null,
      status: "due",
      completedAt: null,
      note: "",
      source: "local",
      updatedAt: timestamp,
    });
    return routine;
  }

  async updateRoutine(id: string, input: RoutineInput) {
    const routine = this.routines.find((item) => item.id === id);
    if (!routine) throw new Error("Routine not found.");
    Object.assign(routine, input, { updatedAt: new Date().toISOString() });
    return routine;
  }

  async archiveRoutine(id: string) {
    const routine = this.routines.find((item) => item.id === id);
    if (routine) routine.state = "archived";
  }

  async updateOccurrence(
    routineId: string,
    scheduledDate: string,
    status: "upcoming" | "due" | "completed" | "skipped",
    note = "",
  ) {
    const occurrence = this.occurrences.find(
      (item) =>
        item.routineId === routineId && item.scheduledDate === scheduledDate,
    );
    if (!occurrence) throw new Error("Occurrence not found.");
    occurrence.status = status;
    occurrence.note = note;
    return occurrence;
  }

  async updatePreferences(input: TimePreferences) {
    this.preferences = { ...input, updatedAt: new Date().toISOString() };
    return this.preferences;
  }

  async updateReminder(
    id: string,
    action: "seen" | "snooze" | "resolve" | "dismiss",
    snoozedUntil?: string,
  ) {
    const reminder = this.reminderInstances.find((item) => item.id === id);
    if (!reminder) throw new Error("Reminder not found.");
    reminder.state =
      action === "seen"
        ? "seen"
        : action === "snooze"
          ? "snoozed"
          : action === "dismiss"
            ? "dismissed"
            : "resolved";
    reminder.snoozedUntil = action === "snooze" ? (snoozedUntil ?? null) : null;
    reminder.updatedAt = new Date().toISOString();
    return reminder;
  }
}
