import {
  addDays,
  localDateInZone,
  localTimeInZone,
  zonedDateTimeToUtc,
} from "../time/rules";
import type {
  CalendarEvent,
  CalendarEventInput,
  TimePreferences,
} from "../time/types";
import { scheduleWarnings } from "../time/phase-two";
import type {
  AtlasAnswer,
  AvailabilityRequest,
  AvailabilitySlot,
  CapturePreview,
  PatternInsight,
} from "./types";

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

function dateParts(value: string) {
  return value.split("-").map(Number) as [number, number, number];
}

function dateKey(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(
    2,
    "0",
  )}-${String(day).padStart(2, "0")}`;
}

function dateDay(value: string) {
  return new Date(`${value}T12:00:00Z`).getUTCDay();
}

function parseClock(
  hourText: string,
  minuteText: string | undefined,
  meridiem: string | undefined,
) {
  let hour = Number(hourText);
  const minute = Number(minuteText ?? 0);
  const suffix = meridiem?.toLowerCase();
  if (suffix === "pm" && hour < 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function addMinutes(time: string, minutes: number) {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  return {
    time: `${String(Math.floor((total % 1_440) / 60)).padStart(
      2,
      "0",
    )}:${String(total % 60).padStart(2, "0")}`,
    dayOffset: Math.floor(total / 1_440),
  };
}

function baseEvent(date: string, timeZone: string): CalendarEventInput {
  return {
    title: "",
    eventType: "personal",
    notes: "",
    location: "",
    provider: "",
    meetingUrl: "",
    amount: null,
    currency: "USD",
    paymentStatus: null,
    priority: "standard",
    status: "scheduled",
    allDay: true,
    localDate: date,
    endLocalDate: date,
    startTime: null,
    endTime: null,
    timeZone,
    recurrence: null,
    reminderOffsets: [],
    relationship: "",
    birthYear: null,
    giftIdea: "",
    contactMethod: "",
    billCategory: "",
    autopay: false,
    accountNote: "",
    paidAt: null,
    escalationEnabled: true,
    sensitive: false,
    organizer: "",
    attendees: [],
    preparationChecklist: [],
  };
}

function parseDate(
  input: string,
  today: string,
  assumptions: string[],
  ambiguities: string[],
) {
  const lower = input.toLowerCase();
  if (/\btoday\b/.test(lower)) return today;
  if (/\btomorrow\b/.test(lower)) return addDays(today, 1);
  const isoDate = input.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoDate) return isoDate[1];

  for (let index = 0; index < WEEKDAYS.length; index += 1) {
    const weekday = WEEKDAYS[index];
    if (!new RegExp(`\\b${weekday}\\b`, "i").test(input)) continue;
    let offset = (index - dateDay(today) + 7) % 7;
    if (offset === 0) offset += 7;
    assumptions.push(
      `${weekday[0].toUpperCase()}${weekday.slice(1)} means ${addDays(
        today,
        offset,
      )}.`,
    );
    return addDays(today, offset);
  }

  for (let monthIndex = 0; monthIndex < MONTHS.length; monthIndex += 1) {
    const match = input.match(
      new RegExp(
        `\\b${MONTHS[monthIndex]}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`,
        "i",
      ),
    );
    if (!match) continue;
    const [year] = dateParts(today);
    const day = Number(match[1]);
    let result = dateKey(year, monthIndex + 1, day);
    if (result < today) result = dateKey(year + 1, monthIndex + 1, day);
    assumptions.push(`No year was supplied, so the next ${result} is used.`);
    return result;
  }

  const monthly = input.match(/\bon\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (monthly) {
    const [year, month] = dateParts(today);
    let result = dateKey(year, month, Number(monthly[1]));
    if (result < today) {
      const nextMonth = month === 12 ? 1 : month + 1;
      result = dateKey(
        month === 12 ? year + 1 : year,
        nextMonth,
        Number(monthly[1]),
      );
    }
    return result;
  }

  ambiguities.push("A date was not recognized; today is shown for review.");
  return today;
}

function cleanTitle(input: string) {
  const cleaned = input
    .replace(/\b(?:today|tomorrow)\b/gi, "")
    .replace(
      /\bnext\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
      "",
    )
    .replace(
      /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))*\b/gi,
      "",
    )
    .replace(
      /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?\b/gi,
      "",
    )
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?\b/gi, "")
    .replace(/\bfor\s+(?:an?|one|\d+)\s+(?:hours?|hrs?|minutes?|mins?)\b/gi, "")
    .replace(/\bevery\s+(?:year|month|week|day)\b/gi, "")
    .replace(/\bon\s+(?:the\s+)?\d{1,2}(?:st|nd|rd|th)?\b/gi, "")
    .replace(/\$\s?\d+(?:\.\d{1,2})?/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[,.;:\s]+|[,.;:\s]+$/g, "")
    .trim();
  return cleaned || "Untitled event";
}

export function deterministicCapture(
  request: string,
  preferences: TimePreferences,
  now = new Date(),
): Omit<CapturePreview, "id" | "conflicts" | "expiresAt"> {
  const assumptions: string[] = [];
  const ambiguities: string[] = [];
  const inferredFields: string[] = [];
  const today = localDateInZone(now, preferences.timeZone);
  const localDate = parseDate(request, today, assumptions, ambiguities);
  const event = baseEvent(localDate, preferences.timeZone);
  const lower = request.toLowerCase();

  event.title = cleanTitle(request);
  inferredFields.push("title", "date", "timezone");

  if (/\bbirthday\b/.test(lower)) {
    event.eventType = "birthday";
    event.allDay = true;
    event.recurrence = {
      frequency: "yearly",
      interval: 1,
      weekdays: [],
      monthlyMode: "date",
      monthlyWeekday: null,
      monthlyOrdinal: null,
      until: null,
      count: null,
    };
    event.reminderOffsets = [0, 4_320, 20_160];
    inferredFields.push("event type", "annual recurrence", "reminders");
  } else if (/\$|insurance|bill|payment|due\b/.test(lower)) {
    event.eventType = "financial";
    event.paymentStatus = "unpaid";
    event.reminderOffsets = [0, 1_440, 4_320, 10_080];
    const amount = request.match(/\$\s?(\d+(?:\.\d{1,2})?)/);
    if (amount) event.amount = Number(amount[1]);
    inferredFields.push("event type", "payment state", "reminders");
    if (amount) inferredFields.push("amount");
  } else if (/\b(workout|gym|run|training)\b/.test(lower)) {
    event.eventType = "workout";
    event.reminderOffsets = [30];
    inferredFields.push("event type", "reminder");
  } else if (/\b(dentist|doctor|medical|appointment)\b/.test(lower)) {
    event.eventType = "medical";
    event.reminderOffsets = [120, 1_440, 4_320, 10_080];
    inferredFields.push("event type", "reminders");
  } else if (/\b(lunch|meeting|call|coffee)\b/.test(lower)) {
    event.eventType = "meeting";
    event.reminderOffsets = [15, 60, 1_440];
    inferredFields.push("event type", "reminders");
  }

  const time = request.match(
    /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\b/i,
  );
  if (time) {
    const meridiem = time[3]?.replaceAll(".", "");
    event.startTime = parseClock(time[1], time[2], meridiem);
    if (!meridiem && Number(time[1]) <= 7) {
      event.startTime = parseClock(time[1], time[2], "pm");
      ambiguities.push(
        `${time[1]}${time[2] ? `:${time[2]}` : ""} was interpreted as PM.`,
      );
    }
    const durationMatch = request.match(
      /\bfor\s+(an?|one|\d+)\s+(hours?|hrs?|minutes?|mins?)\b/i,
    );
    let duration = preferences.defaultEventDurationMinutes;
    if (durationMatch) {
      const amount = /a|an|one/i.test(durationMatch[1])
        ? 1
        : Number(durationMatch[1]);
      duration = /hour|hr/i.test(durationMatch[2]) ? amount * 60 : amount;
    }
    const end = addMinutes(event.startTime, duration);
    event.endTime = end.time;
    event.endLocalDate = addDays(localDate, end.dayOffset);
    event.allDay = false;
    inferredFields.push("start time", "end time");
    if (!durationMatch) {
      assumptions.push(
        `Duration defaults to ${preferences.defaultEventDurationMinutes} minutes.`,
      );
    }
  }

  const weekdayMatches = WEEKDAYS.flatMap((weekday, index) =>
    new RegExp(`\\b${weekday}\\b`, "i").test(request) ? [index] : [],
  );
  if (weekdayMatches.length > 1 || /\bevery\s+week\b/.test(lower)) {
    event.recurrence = {
      frequency: "weekly",
      interval: 1,
      weekdays: weekdayMatches.length ? weekdayMatches : [dateDay(localDate)],
      monthlyMode: "date",
      monthlyWeekday: null,
      monthlyOrdinal: null,
      until: null,
      count: null,
    };
    inferredFields.push("weekly recurrence");
  } else if (/\bevery\s+month\b/.test(lower)) {
    event.recurrence = {
      frequency: "monthly",
      interval: 1,
      weekdays: [],
      monthlyMode: "date",
      monthlyWeekday: null,
      monthlyOrdinal: null,
      until: null,
      count: null,
    };
    inferredFields.push("monthly recurrence");
  } else if (/\bevery\s+year\b/.test(lower) && !event.recurrence) {
    event.recurrence = {
      frequency: "yearly",
      interval: 1,
      weekdays: [],
      monthlyMode: "date",
      monthlyWeekday: null,
      monthlyOrdinal: null,
      until: null,
      count: null,
    };
    inferredFields.push("annual recurrence");
  }

  const reminder = request.match(
    /\b(?:remind me\s+)?(one|two|\d+)\s+(days?|weeks?|hours?)\s+before\b/i,
  );
  if (reminder) {
    const count =
      reminder[1].toLowerCase() === "one"
        ? 1
        : reminder[1].toLowerCase() === "two"
          ? 2
          : Number(reminder[1]);
    const unit = /week/i.test(reminder[2])
      ? 10_080
      : /day/i.test(reminder[2])
        ? 1_440
        : 60;
    event.reminderOffsets = [count * unit];
    inferredFields.push("reminder timing");
  }

  return {
    request,
    summary: `Create “${event.title}” on ${event.localDate}${
      event.startTime ? ` at ${event.startTime}` : ""
    }.`,
    event,
    destinationSourceId: null,
    inferredFields: [...new Set(inferredFields)],
    assumptions,
    ambiguities,
    engine: "deterministic",
  };
}

function eventInput(event: CalendarEvent): CalendarEventInput {
  return {
    title: event.title,
    eventType: event.eventType,
    notes: event.notes,
    location: event.location,
    provider: event.provider,
    meetingUrl: event.meetingUrl,
    amount: event.amount,
    currency: event.currency,
    paymentStatus: event.paymentStatus,
    priority: event.priority,
    status: event.status,
    allDay: event.allDay,
    localDate: event.localDate,
    endLocalDate: event.endLocalDate,
    startTime: event.startTime,
    endTime: event.endTime,
    timeZone: event.timeZone,
    recurrence: event.recurrence,
    reminderOffsets: event.reminderOffsets,
    relationship: event.relationship,
    birthYear: event.birthYear,
    giftIdea: event.giftIdea,
    contactMethod: event.contactMethod,
    billCategory: event.billCategory,
    autopay: event.autopay,
    accountNote: event.accountNote,
    paidAt: event.paidAt,
    escalationEnabled: event.escalationEnabled,
    sensitive: event.sensitive,
    organizer: event.organizer,
    attendees: event.attendees,
    preparationChecklist: event.preparationChecklist,
  };
}

export function findAvailability(
  events: CalendarEvent[],
  preferences: TimePreferences,
  request: AvailabilityRequest,
): AvailabilitySlot[] {
  const period =
    request.preferredPeriod === "morning"
      ? [8 * 60, 12 * 60]
      : request.preferredPeriod === "afternoon"
        ? [12 * 60, 17 * 60]
        : request.preferredPeriod === "evening"
          ? [17 * 60, 21 * 60]
          : [8 * 60, 20 * 60];
  const slots: AvailabilitySlot[] = [];
  for (
    let date = request.startDate;
    date <= request.endDate && slots.length < 6;
    date = addDays(date, 1)
  ) {
    const dateEvents = events
      .filter(
        (event) =>
          event.status === "scheduled" &&
          !event.allDay &&
          event.startAt &&
          event.endAt &&
          event.localDate <= date &&
          event.endLocalDate >= date,
      )
      .sort((a, b) => (a.startAt ?? "").localeCompare(b.startAt ?? ""));
    for (
      let minute = period[0];
      minute + request.durationMinutes <= period[1] && slots.length < 6;
      minute += 15
    ) {
      const startTime = `${String(Math.floor(minute / 60)).padStart(
        2,
        "0",
      )}:${String(minute % 60).padStart(2, "0")}`;
      const end = addMinutes(startTime, request.durationMinutes);
      const startAt = zonedDateTimeToUtc(date, startTime, preferences.timeZone);
      const endAt = zonedDateTimeToUtc(
        addDays(date, end.dayOffset),
        end.time,
        preferences.timeZone,
      );
      const bufferedStart =
        Date.parse(startAt) - preferences.transitionBufferMinutes * 60_000;
      const bufferedEnd =
        Date.parse(endAt) + preferences.transitionBufferMinutes * 60_000;
      const blocked = dateEvents.some(
        (event) =>
          bufferedStart < Date.parse(event.endAt!) &&
          bufferedEnd > Date.parse(event.startAt!),
      );
      if (blocked) continue;
      const nearby = dateEvents
        .filter(
          (event) =>
            Math.abs(Date.parse(event.startAt!) - Date.parse(endAt)) <=
              2 * 60 * 60_000 ||
            Math.abs(Date.parse(startAt) - Date.parse(event.endAt!)) <=
              2 * 60 * 60_000,
        )
        .slice(0, 2)
        .map(({ id, title, startAt: nearbyStart, endAt: nearbyEnd }) => ({
          id,
          title,
          startAt: nearbyStart,
          endAt: nearbyEnd,
        }));
      slots.push({
        startAt,
        endAt,
        localDate: date,
        startTime,
        endTime: end.time,
        reason: `Open after applying a ${preferences.transitionBufferMinutes}-minute transition buffer.`,
        nearby,
        softPreferenceViolated: false,
      });
      minute += Math.max(0, request.durationMinutes - 15);
    }
  }
  return slots;
}

function fact(event: CalendarEvent) {
  return {
    eventId: event.id,
    occurrenceKey: event.occurrenceKey,
    label: event.title,
    localDate: event.localDate,
  };
}

export function deterministicAnswer(
  query: string,
  events: CalendarEvent[],
  preferences: TimePreferences,
  now = new Date(),
): AtlasAnswer {
  const lower = query.toLowerCase();
  const today = localDateInZone(now, preferences.timeZone);
  const tomorrow = addDays(today, 1);
  const scheduled = events.filter((event) => event.status === "scheduled");
  let matched: CalendarEvent[] = [];
  let answer = "";
  let interpretation = "Upcoming calendar commitments";
  const suggestions: string[] = [];

  if (/\btomorrow\b/.test(lower)) {
    matched = scheduled.filter((event) => event.localDate === tomorrow);
    interpretation = `Events on ${tomorrow}`;
    answer = matched.length
      ? `${matched.length} commitment${matched.length === 1 ? "" : "s"} tomorrow: ${matched
          .slice(0, 4)
          .map((event) => event.title)
          .join(", ")}.`
      : "Tomorrow is open in the calendars currently included in Atlas.";
  } else if (/\bbills?\b/.test(lower)) {
    matched = scheduled.filter(
      (event) =>
        event.eventType === "financial" && event.paymentStatus !== "paid",
    );
    interpretation = "Visible unpaid bills";
    answer = matched.length
      ? `${matched.length} unpaid bill${matched.length === 1 ? " is" : "s are"} visible. The next is ${matched[0].title} on ${matched[0].localDate}.`
      : "No unpaid bills are visible in the current Calendar range.";
  } else if (/\bbirthday/.test(lower)) {
    matched = scheduled.filter((event) => event.eventType === "birthday");
    interpretation = "Upcoming birthdays";
    answer = matched.length
      ? `The next birthday is ${matched[0].title} on ${matched[0].localDate}.`
      : "No birthdays are visible in the current Calendar range.";
  } else if (/\b(overlap|conflict|overloaded)\b/.test(lower)) {
    const warnings = scheduleWarnings(
      scheduled,
      preferences.transitionBufferMinutes,
    );
    const ids = new Set(
      warnings.flatMap((warning) => [warning.first.id, warning.second.id]),
    );
    matched = scheduled.filter((event) => ids.has(event.id));
    interpretation = "Deterministic overlap and transition warnings";
    answer = warnings.length
      ? `${warnings.length} schedule warning${warnings.length === 1 ? "" : "s"} found. ${warnings[0].message}`
      : "No overlap or tight-transition warnings were found in the current range.";
  } else if (/\b(next|what.*have|schedule)\b/.test(lower)) {
    matched = scheduled
      .filter(
        (event) => !event.startAt || Date.parse(event.startAt) >= now.getTime(),
      )
      .slice(0, 5);
    interpretation = "Next visible commitments";
    answer = matched.length
      ? `Next: ${matched[0].title} on ${matched[0].localDate}${
          matched[0].startAt
            ? ` at ${localTimeInZone(matched[0].startAt, preferences.timeZone)}`
            : ""
        }.`
      : "No upcoming commitment is visible in the current Calendar range.";
  } else {
    matched = scheduled
      .filter((event) =>
        [event.title, event.notes, event.location, event.eventType]
          .join(" ")
          .toLowerCase()
          .includes(lower.trim()),
      )
      .slice(0, 10);
    interpretation = `Exact Calendar search for “${query.trim()}”`;
    answer = matched.length
      ? `${matched.length} matching event${matched.length === 1 ? "" : "s"} found.`
      : "No exact Calendar match was found. Structured search remains available.";
  }

  if (matched.some((event) => event.priority === "critical")) {
    suggestions.push("Review the critical item before moving flexible events.");
  }
  return {
    answer,
    interpretation,
    facts: matched.map(fact),
    suggestions,
    engine: "deterministic",
  };
}

export function patternInsights(
  events: CalendarEvent[],
  preferences: TimePreferences,
): PatternInsight[] {
  const insights: PatternInsight[] = [];
  const scheduled = events.filter((event) => event.status === "scheduled");
  const warnings = scheduleWarnings(
    scheduled,
    preferences.transitionBufferMinutes,
  );
  const conflicts = warnings.filter((warning) => warning.kind === "conflict");
  if (conflicts.length >= 2) {
    insights.push({
      id: "insight:conflicts",
      kind: "conflict",
      observation: `${conflicts.length} overlapping commitments appear in the visible range.`,
      evidence: `${conflicts.length} deterministic overlap warnings`,
      dateRange:
        scheduled.length > 0
          ? `${scheduled[0].localDate}–${scheduled.at(-1)!.localDate}`
          : "Current range",
      suggestion: "Review the overlapping events before moving flexible time.",
      dismissed: false,
      muted: false,
    });
  }
  const lateBills = events.filter(
    (event) =>
      event.eventType === "financial" &&
      event.paymentStatus === "unpaid" &&
      event.status === "scheduled" &&
      event.localDate < localDateInZone(new Date(), preferences.timeZone),
  );
  if (lateBills.length >= 2) {
    insights.push({
      id: "insight:late-bills",
      kind: "late-bill",
      observation: `${lateBills.length} visible bills are unresolved after their due date.`,
      evidence: lateBills.map((event) => event.title).join(", "),
      dateRange: `${lateBills[0].localDate}–${lateBills.at(-1)!.localDate}`,
      suggestion: "Review their reminder timing or mark resolved bills paid.",
      dismissed: false,
      muted: false,
    });
  }
  return insights;
}

export function calendarEventInput(event: CalendarEvent) {
  return eventInput(event);
}
