import type {
  CalendarEventInput,
  CalendarEventType,
  RecurrenceRule,
} from "./types";

export interface CalendarEventTypeDefinition {
  label: string;
  description: string;
  actionable: boolean;
  defaultAllDay: boolean;
  defaultReminderOffsets: number[];
  defaultRecurrence: RecurrenceRule | null;
}

const annualRecurrence: RecurrenceRule = {
  frequency: "yearly",
  interval: 1,
  weekdays: [],
  monthlyMode: "date",
  until: null,
  count: null,
};

export const CALENDAR_EVENT_TYPES: Record<
  CalendarEventType,
  CalendarEventTypeDefinition
> = {
  personal: {
    label: "Personal",
    description: "A personal commitment or appointment.",
    actionable: false,
    defaultAllDay: false,
    defaultReminderOffsets: [],
    defaultRecurrence: null,
  },
  medical: {
    label: "Medical",
    description: "An appointment or personal health commitment.",
    actionable: false,
    defaultAllDay: false,
    defaultReminderOffsets: [120, 1_440, 4_320, 10_080],
    defaultRecurrence: null,
  },
  financial: {
    label: "Financial",
    description: "A personal bill or financial obligation.",
    actionable: true,
    defaultAllDay: true,
    defaultReminderOffsets: [0, 1_440, 4_320, 10_080],
    defaultRecurrence: null,
  },
  meeting: {
    label: "Meeting",
    description: "A personal work or coordination commitment.",
    actionable: false,
    defaultAllDay: false,
    defaultReminderOffsets: [15, 60, 1_440],
    defaultRecurrence: null,
  },
  workout: {
    label: "Workout",
    description: "A scheduled training session.",
    actionable: true,
    defaultAllDay: false,
    defaultReminderOffsets: [30],
    defaultRecurrence: null,
  },
  protocol: {
    label: "Protocol",
    description: "A user-managed protocol action.",
    actionable: true,
    defaultAllDay: false,
    defaultReminderOffsets: [30],
    defaultRecurrence: null,
  },
  family: {
    label: "Family",
    description: "A family commitment or important date.",
    actionable: false,
    defaultAllDay: false,
    defaultReminderOffsets: [],
    defaultRecurrence: null,
  },
  birthday: {
    label: "Birthday",
    description: "An annual birthday or celebration.",
    actionable: false,
    defaultAllDay: true,
    defaultReminderOffsets: [0, 4_320, 20_160],
    defaultRecurrence: annualRecurrence,
  },
  travel: {
    label: "Travel",
    description: "Travel time or a personal trip milestone.",
    actionable: false,
    defaultAllDay: false,
    defaultReminderOffsets: [60, 1_440],
    defaultRecurrence: null,
  },
  reminder: {
    label: "Reminder",
    description: "A time-bound item that must not be forgotten.",
    actionable: true,
    defaultAllDay: false,
    defaultReminderOffsets: [15],
    defaultRecurrence: null,
  },
  custom: {
    label: "Custom",
    description: "A personal event with custom details.",
    actionable: false,
    defaultAllDay: false,
    defaultReminderOffsets: [],
    defaultRecurrence: null,
  },
};

export function eventTypeDefaults(type: CalendarEventType) {
  const definition = CALENDAR_EVENT_TYPES[type];
  return {
    allDay: definition.defaultAllDay,
    recurrence: definition.defaultRecurrence,
    reminderOffsets: [...definition.defaultReminderOffsets],
  } satisfies Pick<
    CalendarEventInput,
    "allDay" | "recurrence" | "reminderOffsets"
  >;
}

export function eventTypeLabel(type: CalendarEventType) {
  return CALENDAR_EVENT_TYPES[type].label;
}

export function eventIsActionable(type: CalendarEventType) {
  return CALENDAR_EVENT_TYPES[type].actionable;
}
