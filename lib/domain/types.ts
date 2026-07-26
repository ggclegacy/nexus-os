export type DataSource = "local" | "imported" | "atlas";

export type PriorityStatus = "active" | "completed";

export interface Priority {
  id: string;
  title: string;
  notes?: string;
  dueAt: string | null;
  status: PriorityStatus;
  position: number;
  isTop?: boolean;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  archivedAt?: string | null;
  reminderEnabled?: boolean;
  reminderOffsetMinutes?: number | null;
  source: DataSource;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export type TimelineKind = "event" | "all-day" | "routine";
export type TimelineStatus = "scheduled" | "completed" | "skipped";

export interface TimelineItem {
  id: string;
  title: string;
  kind: TimelineKind;
  status: TimelineStatus;
  startAt: string | null;
  endAt: string | null;
  localDate: string;
  timeZone: string;
  notes: string;
  source: DataSource;
  createdAt: string;
  updatedAt: string;
  seriesId?: string | null;
  occurrenceDate?: string;
  occurrenceKey?: string;
  isRecurring?: boolean;
  routineId?: string | null;
  location?: string;
  category?: string | null;
  conflictState?: "none" | "local-newer" | "remote-newer";
}

export type SurfaceState =
  | "loaded"
  | "empty"
  | "partial"
  | "stale"
  | "offline"
  | "denied"
  | "error"
  | "unavailable";

export interface SurfaceResult<T> {
  state: SurfaceState;
  data: T;
  error?: string;
}

export interface ProtocolSummary {
  configured: false;
  dueNow: number;
  upcoming: number;
  completedToday: number;
}

export interface WorkoutRecoverySummary {
  workoutPlanned: null;
  lastWorkout: null;
  sleepDurationMinutes: null;
  sleepQuality: null;
  recovery: null;
}

export type AlertKind = "overdue" | "protocol" | "sync" | "deadline" | "review";

export interface CommandAlert {
  id: string;
  kind: AlertKind;
  severity: "attention" | "important";
  title: string;
  detail: string;
}

export interface DailyBriefing {
  eyebrow: string;
  summary: string;
  nextStep: string;
  nextCommitment: string | null;
  facts: string[];
}

export interface CommandData {
  date: string;
  timeZone: string;
  sourceLabel: string;
  lastUpdatedAt: string;
  priorities: SurfaceResult<Priority[]>;
  timeline: SurfaceResult<TimelineItem[]>;
  protocol: SurfaceResult<ProtocolSummary>;
  performance: SurfaceResult<WorkoutRecoverySummary>;
  alerts: SurfaceResult<CommandAlert[]>;
  briefing: SurfaceResult<DailyBriefing>;
  atlasAvailable: false;
}

export interface PriorityInput {
  title: string;
  notes?: string;
  dueAt?: string | null;
  isTop?: boolean;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  reminderEnabled?: boolean;
  reminderOffsetMinutes?: number | null;
}

export interface PriorityUpdate {
  title?: string;
  notes?: string;
  dueAt?: string | null;
  status?: PriorityStatus;
  isTop?: boolean;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  archived?: boolean;
  reminderEnabled?: boolean;
  reminderOffsetMinutes?: number | null;
}

export interface TimelineInput {
  title: string;
  kind: TimelineKind;
  startAt?: string | null;
  endAt?: string | null;
  localDate: string;
  timeZone: string;
  notes?: string;
}

export interface TimelineUpdate extends Partial<TimelineInput> {
  status?: TimelineStatus;
}
