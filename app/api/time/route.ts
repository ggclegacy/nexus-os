import { listCalendarPayload } from "../../../db/time-repository";
import { daysBetween } from "../../../lib/time/rules";
import type { CalendarFilters } from "../../../lib/time/types";
import { jsonError } from "../../../lib/server/http";

function date(value: string | null, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function enabled(value: string | null, fallback = true) {
  return value === null ? fallback : value !== "false";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const today = new Date().toISOString().slice(0, 10);
    const start = date(url.searchParams.get("start"), today);
    const end = date(url.searchParams.get("end"), start);
    if (daysBetween(start, end) > 93) {
      return Response.json(
        { error: "Calendar ranges are limited to 94 days." },
        { status: 400 },
      );
    }
    const filters: CalendarFilters = {
      query: (url.searchParams.get("query") ?? "").slice(0, 160),
      includeEvents: enabled(url.searchParams.get("events")),
      includePriorities: enabled(url.searchParams.get("priorities")),
      includeRoutines: enabled(url.searchParams.get("routines")),
      includeCompleted: enabled(url.searchParams.get("completed"), false),
    };
    const requestedTimeZone = url.searchParams.get("timeZone");
    const displayTimeZone = requestedTimeZone
      ? new Intl.DateTimeFormat("en-US", {
          timeZone: requestedTimeZone,
        }).resolvedOptions().timeZone
      : undefined;
    return Response.json(
      await listCalendarPayload(start, end, filters, displayTimeZone),
      {
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}
