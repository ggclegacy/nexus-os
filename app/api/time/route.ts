import { listCalendarPayload } from "../../../db/time-repository";
import { listCalendarSources } from "../../../db/calendar-intelligence-repository";
import { ValidationError } from "../../../lib/domain/validation";
import { daysBetween } from "../../../lib/time/rules";
import type { CalendarFilters } from "../../../lib/time/types";
import { parseDateKey } from "../../../lib/time/validation";
import { jsonError } from "../../../lib/server/http";

function date(value: string | null, fallback: string) {
  return value === null ? fallback : parseDateKey(value, "Calendar date");
}

function enabled(value: string | null, fallback = true) {
  if (value === null) return fallback;
  if (value !== "true" && value !== "false") {
    throw new ValidationError("Calendar filter is invalid.");
  }
  return value === "true";
}

function list<T extends string>(
  value: string | null,
  allowed: readonly T[],
  label: string,
) {
  if (!value) return [];
  const values = [...new Set(value.split(",").filter(Boolean))];
  if (values.some((item) => !allowed.includes(item as T))) {
    throw new ValidationError(`${label} filter is invalid.`);
  }
  return values as T[];
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const today = new Date().toISOString().slice(0, 10);
    const start = date(url.searchParams.get("start"), today);
    const end = date(url.searchParams.get("end"), start);
    const rangeDays = daysBetween(start, end);
    if (rangeDays < 0 || rangeDays > 370) {
      return Response.json(
        {
          error:
            rangeDays < 0
              ? "Calendar range end must not precede its start."
              : "Calendar ranges are limited to 371 days.",
        },
        { status: 400 },
      );
    }
    const filters: CalendarFilters = {
      query: (url.searchParams.get("query") ?? "").slice(0, 160),
      includeEvents: enabled(url.searchParams.get("events")),
      includePriorities: enabled(url.searchParams.get("priorities")),
      includeRoutines: enabled(url.searchParams.get("routines")),
      includeCompleted: enabled(url.searchParams.get("completed"), false),
      eventTypes: list(
        url.searchParams.get("types"),
        [
          "personal",
          "medical",
          "financial",
          "meeting",
          "workout",
          "protocol",
          "family",
          "birthday",
          "travel",
          "reminder",
          "custom",
        ] as const,
        "Event type",
      ),
      statuses: list(
        url.searchParams.get("statuses"),
        ["scheduled", "completed", "dismissed", "cancelled"] as const,
        "Status",
      ),
      priorities: list(
        url.searchParams.get("importance"),
        ["standard", "important", "critical"] as const,
        "Priority",
      ),
      payment: ["all", "paid", "unpaid"].includes(
        url.searchParams.get("payment") ?? "all",
      )
        ? ((url.searchParams.get("payment") ??
            "all") as CalendarFilters["payment"])
        : (() => {
            throw new ValidationError("Payment filter is invalid.");
          })(),
      recurrence: ["all", "recurring", "one-time"].includes(
        url.searchParams.get("recurrence") ?? "all",
      )
        ? ((url.searchParams.get("recurrence") ??
            "all") as CalendarFilters["recurrence"])
        : (() => {
            throw new ValidationError("Recurrence filter is invalid.");
          })(),
    };
    const requestedTimeZone = url.searchParams.get("timeZone");
    const displayTimeZone = requestedTimeZone
      ? new Intl.DateTimeFormat("en-US", {
          timeZone: requestedTimeZone,
        }).resolvedOptions().timeZone
      : undefined;
    const [payload, sources] = await Promise.all([
      listCalendarPayload(start, end, filters, displayTimeZone),
      listCalendarSources(),
    ]);
    const visibleSources = new Set(
      sources.filter((source) => source.visible).map((source) => source.id),
    );
    payload.events = payload.events.filter(
      (event) =>
        event.source === "local" ||
        (event.sourceId !== null && visibleSources.has(event.sourceId)),
    );
    const hasProviderSnapshot = sources.some(
      (source) => source.provider !== "nexus" && source.visible,
    );
    const hasConnectedProvider = sources.some(
      (source) =>
        source.provider !== "nexus" &&
        source.visible &&
        source.syncStatus !== "disconnected",
    );
    payload.sourceLabel = hasConnectedProvider
      ? "Nexus + connected calendars"
      : hasProviderSnapshot
        ? "Nexus + local provider snapshot"
        : "Private local workspace";
    payload.syncAvailable = hasConnectedProvider;
    return Response.json(payload, {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
