import {
  applyInsightPreferences,
  getCalendarPrivacySettings,
  listCalendarAudit,
  listCalendarConnections,
  listCalendarSources,
  listSyncConflicts,
} from "../../db/calendar-intelligence-repository";
import {
  getTimePreferences,
  listCalendarEvents,
} from "../../db/time-repository";
import { patternInsights } from "../calendar-intelligence/deterministic";
import type {
  CalendarCapabilities,
  CalendarIntelligencePayload,
} from "../calendar-intelligence/types";
import { addDays, localDateInZone } from "../time/rules";
import { atlasCalendarConfiguration } from "./atlas-calendar";
import { googleCalendarConfiguration } from "./calendar-secrets";

export function calendarCapabilities(): CalendarCapabilities {
  const google = googleCalendarConfiguration();
  const atlas = atlasCalendarConfiguration();
  return {
    google: {
      configured: google.configured,
      reasonUnavailable: google.reasonUnavailable,
    },
    atlas: {
      configured: atlas.configured,
      model: atlas.configured ? atlas.model : null,
      reasonUnavailable: atlas.reasonUnavailable,
    },
    reconciliation: "manual",
    weather: false,
    travelTime: false,
    attachments: false,
    connectedModules: [],
  };
}

export async function calendarIntelligencePayload(): Promise<CalendarIntelligencePayload> {
  const preferences = await getTimePreferences();
  const today = localDateInZone(new Date(), preferences.timeZone);
  const [connections, sources, conflicts, privacy, audit, events] =
    await Promise.all([
      listCalendarConnections(),
      listCalendarSources(),
      listSyncConflicts(),
      getCalendarPrivacySettings(),
      listCalendarAudit(),
      listCalendarEvents(addDays(today, -90), addDays(today, 180)),
    ]);
  const insights = privacy.patternInsights
    ? await applyInsightPreferences(patternInsights(events, preferences))
    : [];
  return {
    capabilities: calendarCapabilities(),
    connections,
    sources,
    conflicts,
    privacy,
    audit,
    insights,
  };
}

export async function permittedAtlasEvents(start: string, end: string) {
  const [events, sources, privacy] = await Promise.all([
    listCalendarEvents(start, end),
    listCalendarSources(),
    getCalendarPrivacySettings(),
  ]);
  const permitted = new Set(
    sources
      .filter((source) => source.includeInAtlas)
      .map((source) => source.id),
  );
  return events.filter(
    (event) =>
      (event.source === "local" ||
        (event.sourceId && permitted.has(event.sourceId))) &&
      (!event.sensitive || privacy.sensitiveEventsInAtlas),
  );
}

export async function visibleCalendarEvents(start: string, end: string) {
  const [events, sources] = await Promise.all([
    listCalendarEvents(start, end),
    listCalendarSources(),
  ]);
  const visible = new Set(
    sources.filter((source) => source.visible).map((source) => source.id),
  );
  return events.filter(
    (event) =>
      event.source === "local" ||
      (event.sourceId && visible.has(event.sourceId)),
  );
}

export async function availabilityCalendarEvents(start: string, end: string) {
  const [events, sources] = await Promise.all([
    listCalendarEvents(start, end),
    listCalendarSources(),
  ]);
  const included = new Set(
    sources
      .filter((source) => source.includeInAvailability)
      .map((source) => source.id),
  );
  return events.filter(
    (event) =>
      event.source === "local" ||
      (event.sourceId && included.has(event.sourceId)),
  );
}
