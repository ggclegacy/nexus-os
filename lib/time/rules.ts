import type {
  RecurrenceRule,
  RoutineOccurrenceStatus,
  TimePreferences,
} from "./types";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_KEY = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 86_400_000;

export function assertDateKey(value: string) {
  if (!DATE_KEY.test(value)) throw new Error("Date must use YYYY-MM-DD.");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Date is not valid.");
  }
  return value;
}

export function assertTimeKey(value: string) {
  if (!TIME_KEY.test(value)) throw new Error("Time must use HH:mm.");
  return value;
}

export function dateNumber(value: string) {
  assertDateKey(value);
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function addDays(value: string, amount: number) {
  return new Date(dateNumber(value) + amount * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function daysBetween(start: string, end: string) {
  return Math.round((dateNumber(end) - dateNumber(start)) / DAY_MS);
}

export function dayOfWeek(value: string) {
  return new Date(dateNumber(value)).getUTCDay();
}

export function startOfWeek(value: string, weekStartsOn: 0 | 1) {
  const weekday = dayOfWeek(value);
  const offset = (weekday - weekStartsOn + 7) % 7;
  return addDays(value, -offset);
}

export function endOfWeek(value: string, weekStartsOn: 0 | 1) {
  return addDays(startOfWeek(value, weekStartsOn), 6);
}

export function dateRange(start: string, end: string, limit = 400) {
  assertDateKey(start);
  assertDateKey(end);
  if (start > end) throw new Error("Range end must not precede range start.");
  const values: string[] = [];
  for (
    let date = start;
    date <= end && values.length < limit;
    date = addDays(date, 1)
  ) {
    values.push(date);
  }
  if (values.at(-1) !== end) throw new Error("Date range is too large.");
  return values;
}

function monthIndex(value: string) {
  const [year, month] = value.split("-").map(Number);
  return year * 12 + month - 1;
}

function relativeWeekday(value: string) {
  const day = Number(value.slice(8, 10));
  const [year, month] = value.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    weekday: dayOfWeek(value),
    ordinal: day + 7 > daysInMonth ? -1 : Math.ceil(day / 7),
  };
}

function matchesMonthly(start: string, date: string, rule: RecurrenceRule) {
  if (rule.monthlyMode === "last-day") {
    const [year, month, day] = date.split("-").map(Number);
    return day === new Date(Date.UTC(year, month, 0)).getUTCDate();
  }
  if (rule.monthlyMode === "date")
    return start.slice(8, 10) === date.slice(8, 10);
  const source = relativeWeekday(start);
  const candidate = relativeWeekday(date);
  const weekday = rule.monthlyWeekday ?? source.weekday;
  const ordinal = rule.monthlyOrdinal ?? source.ordinal;
  return weekday === candidate.weekday && ordinal === candidate.ordinal;
}

function matchesRule(start: string, date: string, rule: RecurrenceRule) {
  const elapsedDays = daysBetween(start, date);
  if (elapsedDays < 0) return false;
  if (rule.frequency === "daily") return elapsedDays % rule.interval === 0;
  if (rule.frequency === "weekly") {
    const week = Math.floor(elapsedDays / 7);
    const weekdays = rule.weekdays.length ? rule.weekdays : [dayOfWeek(start)];
    return week % rule.interval === 0 && weekdays.includes(dayOfWeek(date));
  }
  if (rule.frequency === "monthly") {
    const elapsedMonths = monthIndex(date) - monthIndex(start);
    return (
      elapsedMonths >= 0 &&
      elapsedMonths % rule.interval === 0 &&
      matchesMonthly(start, date, rule)
    );
  }
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [year, month, day] = date.split("-").map(Number);
  const leapDayFallback =
    startMonth === 2 &&
    startDay === 29 &&
    month === 2 &&
    day === 28 &&
    new Date(Date.UTC(year, 1, 29)).getUTCMonth() !== 1;
  return (
    year >= startYear &&
    (year - startYear) % rule.interval === 0 &&
    ((month === startMonth && day === startDay) || leapDayFallback)
  );
}

export function expandRecurrence(
  start: string,
  rangeStart: string,
  rangeEnd: string,
  rule: RecurrenceRule | null,
  maxOccurrences = 500,
) {
  assertDateKey(start);
  assertDateKey(rangeStart);
  assertDateKey(rangeEnd);
  if (!rule) return start >= rangeStart && start <= rangeEnd ? [start] : [];

  const end = rule.until && rule.until < rangeEnd ? rule.until : rangeEnd;
  const results: string[] = [];
  let seen = 0;
  // Without a count limit, matching is deterministic from the original start,
  // so there is no reason to walk historical days before the viewed range.
  // Count-limited rules retain their bounded history scan (at most 100 years).
  const scanStart =
    rule.count === null && rangeStart > start ? rangeStart : start;
  if (end < scanStart) return [];
  for (const date of dateRange(scanStart, end, 36_600)) {
    if (!matchesRule(start, date, rule)) continue;
    seen += 1;
    if (rule.count !== null && seen > rule.count) break;
    if (date >= rangeStart) results.push(date);
    if (results.length >= maxOccurrences) break;
  }
  return results;
}

function partsFor(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((entry) => entry.type === type)?.value ?? 0);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

export function zonedDateTimeToUtc(
  localDate: string,
  localTime: string,
  timeZone: string,
) {
  assertDateKey(localDate);
  assertTimeKey(localTime);
  new Intl.DateTimeFormat("en-US", { timeZone }).format();
  const [year, month, day] = localDate.split("-").map(Number);
  const [hour, minute] = localTime.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = target;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const shown = partsFor(new Date(candidate), timeZone);
    const represented = Date.UTC(
      shown.year,
      shown.month - 1,
      shown.day,
      shown.hour,
      shown.minute,
      shown.second,
    );
    const correction = target - represented;
    if (!correction) break;
    candidate += correction;
  }
  const verified = partsFor(new Date(candidate), timeZone);
  if (
    verified.year !== year ||
    verified.month !== month ||
    verified.day !== day ||
    verified.hour !== hour ||
    verified.minute !== minute
  ) {
    throw new Error(
      "That local time does not exist in the selected time zone because of daylight saving time.",
    );
  }
  return new Date(candidate).toISOString();
}

export function localDateInZone(instant: string | Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function localTimeInZone(instant: string | Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("hour")}:${part("minute")}`;
}

export function isInQuietHours(
  localTime: string,
  preferences: Pick<
    TimePreferences,
    "quietHoursEnabled" | "quietHoursStart" | "quietHoursEnd"
  >,
) {
  if (!preferences.quietHoursEnabled) return false;
  assertTimeKey(localTime);
  const { quietHoursStart: start, quietHoursEnd: end } = preferences;
  assertTimeKey(start);
  assertTimeKey(end);
  if (start === end) return true;
  if (start < end) return localTime >= start && localTime < end;
  return localTime >= start || localTime < end;
}

export function routineOccurrenceStatus(
  scheduledDate: string,
  windowStart: string | null,
  windowEnd: string | null,
  timeZone: string,
  now: Date,
): RoutineOccurrenceStatus {
  const today = localDateInZone(now, timeZone);
  if (scheduledDate > today) return "upcoming";
  if (scheduledDate < today) return "missed";
  const currentTime = localTimeInZone(now, timeZone);
  if (windowEnd && currentTime > windowEnd) return "missed";
  if (windowStart && currentTime < windowStart) return "upcoming";
  return "due";
}

export function recurrenceLabel(rule: RecurrenceRule | null) {
  if (!rule) return "Does not repeat";
  const every = rule.interval === 1 ? "Every" : `Every ${rule.interval}`;
  if (rule.frequency === "daily")
    return rule.interval === 1 ? "Every day" : `${every} days`;
  if (rule.frequency === "weekly") {
    if (
      rule.weekdays.length === 5 &&
      !rule.weekdays.includes(0) &&
      !rule.weekdays.includes(6)
    )
      return "Weekdays";
    return rule.interval === 1 ? "Every week" : `${every} weeks`;
  }
  if (rule.frequency === "monthly") {
    const cadence = rule.interval === 1 ? "Every month" : `${every} months`;
    if (rule.monthlyMode === "last-day") return `${cadence} on the last day`;
    if (rule.monthlyMode === "relative") {
      const ordinal =
        rule.monthlyOrdinal === -1
          ? "last"
          : ["", "first", "second", "third", "fourth"][
              rule.monthlyOrdinal ?? 0
            ] || "matching";
      return `${cadence} on the ${ordinal} weekday`;
    }
    return cadence;
  }
  return rule.interval === 1 ? "Every year" : `${every} years`;
}
