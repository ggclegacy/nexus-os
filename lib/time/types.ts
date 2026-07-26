import type { Priority } from "../domain/types";

export type CalendarView = "agenda" | "day" | "week";
export type TimeArea = CalendarView | "priorities" | "routines";
export type EventStatus = "confirmed" | "tentative" | "canceled";
export type SyncConflictState = "none" | "local-newer" | "remote-newer";
export type RecurrenceFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";
export type RecurrenceEditScope = "occurrence" | "future" | "series";
export type RoutineState = "active" | "paused" | "archived";
export type RoutineOccurrenceStatus =
  | "upcoming"
  | "due"
  | "completed"
  | "skipped"
  | "missed";
export type ReminderEntity = "event" | "priority" | "routine";
export type ReminderChannel = "in-app";
export type ReminderQuietBehavior = "delay" | "suppress" | "allow";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays: number[];
  monthlyMode: "date" | "relative";
  until: string | null;
  count: number | null;
}

export interface CalendarEventInput {
  title: string;
  notes: string;
  location: string;
  category: string | null;
  status: EventStatus;
  allDay: boolean;
  localDate: string;
  endLocalDate: string;
  startTime: string | null;
  endTime: string | null;
  timeZone: string;
  recurrence: RecurrenceRule | null;
  reminderOffsets: number[];
}

export interface CalendarEvent extends CalendarEventInput {
  id: string;
  seriesId: string | null;
  occurrenceDate: string;
  occurrenceKey: string;
  startAt: string | null;
  endAt: string | null;
  source: "local" | "imported";
  sourceId: string | null;
  externalCalendarId: string | null;
  lastSyncedAt: string | null;
  localVersion: number;
  remoteVersion: string | null;
  readOnly: boolean;
  conflictState: SyncConflictState;
  createdAt: string;
  updatedAt: string;
}

export interface EventException {
  id: string;
  seriesId: string;
  originalDate: string;
  kind: "edited" | "canceled" | "additional";
  override: Partial<CalendarEventInput>;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineInput {
  name: string;
  description: string;
  schedule: RecurrenceRule;
  preferredTime: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  expectedMinutes: number | null;
  startDate: string;
  endDate: string | null;
  state: RoutineState;
  reminderEnabled: boolean;
  reminderOffsetMinutes: number | null;
}

export interface Routine extends RoutineInput {
  id: string;
  source: "local";
  createdAt: string;
  updatedAt: string;
}

export interface RoutineOccurrence {
  id: string;
  routineId: string;
  routineName: string;
  scheduledDate: string;
  scheduledAt: string | null;
  windowStartAt: string | null;
  windowEndAt: string | null;
  status: RoutineOccurrenceStatus;
  completedAt: string | null;
  note: string;
  source: "local";
  updatedAt: string;
}

export interface Reminder {
  id: string;
  entityType: ReminderEntity;
  entityId: string;
  offsetMinutes: number;
  channel: ReminderChannel;
  enabled: boolean;
  quietBehavior: ReminderQuietBehavior;
  deliveryStatus: "pending" | "shown" | "suppressed" | "unsupported";
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimePreferences {
  timeZone: string;
  locale: string;
  weekStartsOn: 0 | 1;
  hourCycle: "12" | "24";
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietBehavior: ReminderQuietBehavior;
  notificationPermission: "in-app-only" | "denied";
  updatedAt: string;
}

export interface CalendarFilters {
  query: string;
  includeEvents: boolean;
  includePriorities: boolean;
  includeRoutines: boolean;
  includeCompleted: boolean;
}

export interface CalendarPayload {
  rangeStart: string;
  rangeEnd: string;
  events: CalendarEvent[];
  priorities: Priority[];
  routines: Routine[];
  occurrences: RoutineOccurrence[];
  reminders: Reminder[];
  preferences: TimePreferences;
  sourceLabel: string;
  lastUpdatedAt: string;
  stale: boolean;
  syncAvailable: false;
}

export interface CalendarAdapter {
  listCalendars(): Promise<never[]>;
  pullChanges(cursor?: string): Promise<{ cursor: string | null }>;
  createRemoteEvent(event: CalendarEvent): Promise<never>;
  updateRemoteEvent(event: CalendarEvent): Promise<never>;
  deleteRemoteEvent(event: CalendarEvent): Promise<never>;
  health(): Promise<{
    available: false;
    permission: "not-connected";
    lastSuccessfulSync: null;
  }>;
}
