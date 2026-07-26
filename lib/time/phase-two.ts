import {
  addDays,
  dateRange,
  daysBetween,
  localDateInZone,
  startOfWeek,
  zonedDateTimeToUtc,
} from "./rules";
import type {
  CalendarEvent,
  CalendarPayload,
  ReminderInstance,
  TimePreferences,
} from "./types";

const resolvedEventStatuses = new Set(["completed", "dismissed", "cancelled"]);

export function monthGrid(date: string, weekStartsOn: 0 | 1) {
  const monthStart = `${date.slice(0, 7)}-01`;
  const [year, month] = date.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(year, month, 0))
    .toISOString()
    .slice(0, 10);
  const gridStart = startOfWeek(monthStart, weekStartsOn);
  const gridEnd = addDays(gridStart, 41);
  return {
    monthStart,
    monthEnd,
    gridStart,
    gridEnd,
    dates: dateRange(gridStart, gridEnd),
  };
}

export type ScheduleWarning = {
  id: string;
  kind: "conflict" | "tight-transition";
  first: CalendarEvent;
  second: CalendarEvent;
  minutes: number;
  message: string;
};

export function scheduleWarnings(
  events: CalendarEvent[],
  transitionBufferMinutes: number,
) {
  const timed = events
    .filter(
      (event) =>
        event.startAt &&
        event.endAt &&
        !resolvedEventStatuses.has(event.status),
    )
    .sort(
      (left, right) => Date.parse(left.startAt!) - Date.parse(right.startAt!),
    );
  const warnings: ScheduleWarning[] = [];
  for (let index = 1; index < timed.length; index += 1) {
    const first = timed[index - 1];
    const second = timed[index];
    const gap = Math.round(
      (Date.parse(second.startAt!) - Date.parse(first.endAt!)) / 60_000,
    );
    if (gap < 0) {
      warnings.push({
        id: `conflict:${first.occurrenceKey}:${second.occurrenceKey}`,
        kind: "conflict",
        first,
        second,
        minutes: Math.abs(gap),
        message: `${first.title} overlaps ${second.title} by ${Math.abs(gap)} minutes.`,
      });
    } else if (gap < transitionBufferMinutes) {
      warnings.push({
        id: `transition:${first.occurrenceKey}:${second.occurrenceKey}`,
        kind: "tight-transition",
        first,
        second,
        minutes: gap,
        message: `Only ${gap} minutes between ${first.title} and ${second.title}.`,
      });
    }
  }
  return warnings;
}

export function overloadedDay(
  events: CalendarEvent[],
  preferences: TimePreferences,
) {
  const active = events.filter(
    (event) => !resolvedEventStatuses.has(event.status),
  );
  const scheduledMinutes = active.reduce((total, event) => {
    if (!event.startAt || !event.endAt) return total;
    return (
      total + (Date.parse(event.endAt) - Date.parse(event.startAt)) / 60_000
    );
  }, 0);
  const importantCount = active.filter(
    (event) => event.priority !== "standard",
  ).length;
  return {
    overloaded:
      scheduledMinutes > preferences.overloadMinutesPerDay ||
      importantCount > preferences.overloadImportantItemCount,
    scheduledMinutes,
    importantCount,
  };
}

export function agendaSection(date: string, today: string) {
  const difference = daysBetween(today, date);
  if (difference === 0) return "Today";
  if (difference === 1) return "Tomorrow";
  if (difference <= 7) return "This week";
  return "Later";
}

export function birthdayPlanning(events: CalendarEvent[], today: string) {
  return events
    .filter(
      (event) =>
        event.eventType === "birthday" &&
        event.localDate >= today &&
        !resolvedEventStatuses.has(event.status),
    )
    .sort((left, right) => left.localDate.localeCompare(right.localDate))
    .map((event) => {
      const days = daysBetween(today, event.localDate);
      const occurrenceYear = Number(event.localDate.slice(0, 4));
      return {
        event,
        days,
        age:
          event.birthYear && occurrenceYear >= event.birthYear
            ? occurrenceYear - event.birthYear
            : null,
        horizon:
          days <= 14
            ? "Next 14 days"
            : days <= 30
              ? "Next 30 days"
              : "Later this year",
      };
    });
}

export function billPlanning(
  events: CalendarEvent[],
  today: string,
  locale: string,
) {
  const bills = events
    .filter((event) => event.eventType === "financial")
    .sort((left, right) => left.localDate.localeCompare(right.localDate));
  const visibleUnpaid = bills.filter(
    (event) =>
      event.paymentStatus !== "paid" &&
      !["dismissed", "cancelled"].includes(event.status),
  );
  const totals = new Map<string, number>();
  for (const bill of visibleUnpaid) {
    if (bill.amount === null) continue;
    totals.set(bill.currency, (totals.get(bill.currency) ?? 0) + bill.amount);
  }
  return {
    dueSoon: visibleUnpaid.filter(
      (event) =>
        event.localDate >= today && daysBetween(today, event.localDate) <= 7,
    ),
    laterThisMonth: visibleUnpaid.filter(
      (event) =>
        event.localDate > addDays(today, 7) &&
        event.localDate.slice(0, 7) === today.slice(0, 7),
    ),
    overdue: visibleUnpaid.filter((event) => event.localDate < today),
    paidThisMonth: bills.filter(
      (event) =>
        event.paymentStatus === "paid" &&
        (event.paidAt
          ? localDateInZone(event.paidAt, event.timeZone).slice(0, 7)
          : event.localDate.slice(0, 7)) === today.slice(0, 7),
    ),
    totals: [...totals.entries()].map(([currency, amount]) => ({
      currency,
      amount,
      formatted: new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
      }).format(amount),
    })),
  };
}

export function reminderBuckets(
  reminders: ReminderInstance[],
  events: CalendarEvent[],
  now: Date,
) {
  const eventMap = new Map(events.map((event) => [event.occurrenceKey, event]));
  const active = reminders.filter((reminder) =>
    eventMap.has(reminder.occurrenceKey),
  );
  return {
    needsAction: active.filter((reminder) => {
      if (!["delivered", "seen"].includes(reminder.state)) return false;
      const event = eventMap.get(reminder.occurrenceKey);
      const due = event?.startAt
        ? Date.parse(event.startAt)
        : Date.parse(reminder.scheduledFor);
      return due <= now.getTime();
    }),
    snoozed: active.filter((reminder) => reminder.state === "snoozed"),
    upcoming: active.filter(
      (reminder) =>
        reminder.state === "scheduled" &&
        Date.parse(reminder.scheduledFor) > now.getTime(),
    ),
    resolved: active.filter((reminder) =>
      ["resolved", "dismissed", "expired"].includes(reminder.state),
    ),
  };
}

export function rescueCandidates(events: CalendarEvent[], now: Date) {
  return events
    .filter(
      (event) =>
        !event.allDay &&
        event.endAt &&
        Date.parse(event.endAt) < now.getTime() &&
        event.status === "scheduled" &&
        (event.eventType === "financial" ||
          event.eventType === "workout" ||
          event.eventType === "protocol" ||
          event.eventType === "reminder"),
    )
    .sort((left, right) => Date.parse(left.endAt!) - Date.parse(right.endAt!));
}

export function calendarBrief(
  data: CalendarPayload,
  now: Date,
  mode: "morning" | "evening",
) {
  const today = localDateInZone(now, data.preferences.timeZone);
  const tomorrow = addDays(today, 1);
  const todayEvents = data.events.filter((event) => event.localDate === today);
  const tomorrowEvents = data.events.filter(
    (event) => event.localDate === tomorrow,
  );
  const activeToday = todayEvents.filter(
    (event) => !resolvedEventStatuses.has(event.status),
  );
  const warnings = scheduleWarnings(
    activeToday,
    data.preferences.transitionBufferMinutes,
  );
  const bills = data.events.filter(
    (event) =>
      event.eventType === "financial" &&
      event.paymentStatus !== "paid" &&
      event.localDate >= today &&
      event.localDate <= addDays(today, 7),
  );
  const birthdays = data.events.filter(
    (event) =>
      event.eventType === "birthday" &&
      event.localDate >= today &&
      event.localDate <= addDays(today, 14),
  );
  if (mode === "morning") {
    return {
      title: "Morning Brief",
      summary: `${activeToday.length} scheduled commitment${activeToday.length === 1 ? "" : "s"} today.`,
      first: activeToday.find((event) => event.startAt) ?? null,
      important:
        activeToday.find((event) => event.priority === "critical") ??
        activeToday.find((event) => event.priority === "important") ??
        null,
      bills,
      birthdays,
      warnings,
      unresolved: rescueCandidates(data.events, now),
    };
  }
  return {
    title: "Evening Brief",
    summary: `${todayEvents.filter((event) => event.status === "completed").length} completed · ${activeToday.length} unresolved.`,
    first:
      tomorrowEvents
        .filter((event) => event.startAt)
        .sort(
          (left, right) =>
            Date.parse(left.startAt!) - Date.parse(right.startAt!),
        )[0] ?? null,
    important: null,
    bills,
    birthdays,
    warnings,
    unresolved: activeToday,
  };
}

export function snoozeTime(
  choice: "15m" | "1h" | "later-today" | "tomorrow",
  now: Date,
  timeZone: string,
) {
  if (choice === "15m")
    return new Date(now.getTime() + 15 * 60_000).toISOString();
  if (choice === "1h")
    return new Date(now.getTime() + 60 * 60_000).toISOString();
  const today = localDateInZone(now, timeZone);
  if (choice === "later-today") {
    const candidate = zonedDateTimeToUtc(today, "18:00", timeZone);
    return Date.parse(candidate) > now.getTime()
      ? candidate
      : new Date(now.getTime() + 60 * 60_000).toISOString();
  }
  return zonedDateTimeToUtc(addDays(today, 1), "09:00", timeZone);
}
