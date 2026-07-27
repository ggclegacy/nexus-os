import type { Priority } from "../domain/types";

export type CalendarView = "agenda" | "day" | "week" | "month";
export type TimeArea =
  | CalendarView
  | "reminders"
  | "birthdays"
  | "bills"
  | "priorities"
  | "routines";
export type CalendarEventType =
  | "personal"
  | "medical"
  | "financial"
  | "meeting"
  | "workout"
  | "protocol"
  | "family"
  | "birthday"
  | "travel"
  | "reminder"
  | "custom";
export type EventStatus = "scheduled" | "completed" | "dismissed" | "cancelled";
export type EventPriority = "standard" | "important" | "critical";
export type SyncConflictState = "none" | "local-newer" | "remote-newer";
export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";
export type RecurrenceEditScope = "occurrence" | "future" | "series";
export type RoutineState = "active" | "paused" | "archived";
export type RoutineOccurrenceStatus =
  "upcoming" | "due" | "completed" | "skipped" | "missed";
export type ReminderEntity = "event" | "priority" | "routine";
export type ReminderChannel = "in-app";
export type ReminderQuietBehavior = "delay" | "suppress" | "allow";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays: number[];
  monthlyMode: "date" | "relative" | "last-day";
  monthlyWeekday?: number | null;
  monthlyOrdinal?: 1 | 2 | 3 | 4 | -1 | null;
  until: string | null;
  count: number | null;
}

export interface CalendarEventInput {
  title: string;
  eventType: CalendarEventType;
  notes: string;
  location: string;
  provider: string;
  meetingUrl: string;
  amount: number | null;
  currency: string;
  paymentStatus: "unpaid" | "paid" | null;
  priority: EventPriority;
  status: EventStatus;
  allDay: boolean;
  localDate: string;
  endLocalDate: string;
  startTime: string | null;
  endTime: string | null;
  timeZone: string;
  recurrence: RecurrenceRule | null;
  reminderOffsets: number[];
  relationship?: string;
  birthYear?: number | null;
  giftIdea?: string;
  contactMethod?: string;
  billCategory?: string;
  autopay?: boolean;
  accountNote?: string;
  paidAt?: string | null;
  escalationEnabled?: boolean;
  sensitive?: boolean;
  organizer?: string;
  attendees?: Array<{
    displayName: string;
    email: string;
    responseStatus: string;
    self: boolean;
  }>;
  preparationChecklist?: string[];
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

export type ReminderState =
  | "scheduled"
  | "delivered"
  | "seen"
  | "snoozed"
  | "resolved"
  | "dismissed"
  | "expired";

export interface ReminderInstance {
  id: string;
  reminderId: string;
  eventId: string;
  occurrenceDate: string;
  occurrenceKey: string;
  scheduledFor: string;
  deliveredAt: string | null;
  seenAt: string | null;
  snoozedUntil: string | null;
  resolvedAt: string | null;
  state: ReminderState;
  reason: string;
  ruleLabel: string;
  escalationLevel: number;
  nextEscalationAt: string | null;
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
  defaultView: CalendarView;
  defaultEventDurationMinutes: number;
  transitionBufferMinutes: number;
  morningBriefTime: string;
  eveningBriefTime: string;
  escalationEnabled: boolean;
  defaultSnoozeMinutes: number;
  overloadMinutesPerDay: number;
  overloadImportantItemCount: number;
  updatedAt: string;
}

export interface CalendarFilters {
  query: string;
  includeEvents: boolean;
  includePriorities: boolean;
  includeRoutines: boolean;
  includeCompleted: boolean;
  eventTypes: CalendarEventType[];
  statuses: EventStatus[];
  priorities: EventPriority[];
  payment: "all" | "paid" | "unpaid";
  recurrence: "all" | "recurring" | "one-time";
}

export interface CalendarPayload {
  rangeStart: string;
  rangeEnd: string;
  events: CalendarEvent[];
  priorities: Priority[];
  routines: Routine[];
  occurrences: RoutineOccurrence[];
  reminders: Reminder[];
  reminderInstances: ReminderInstance[];
  preferences: TimePreferences;
  sourceLabel: string;
  lastUpdatedAt: string;
  stale: boolean;
  syncAvailable: boolean;
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
