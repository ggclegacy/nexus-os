import {
  getCalendarConnectionCredential,
  getCalendarSource,
  getExternalEventLinkByExternal,
  getExternalEventLinkById,
  getExternalEventLinkByLocal,
  getSourceSyncCursor,
  getSyncConflict,
  listCalendarSources,
  markExternalLinkPending,
  recordCalendarAudit,
  recordSyncConflict,
  resolveSyncConflict,
  updateConnectionCredential,
  updateConnectionHealth,
  updateSourceSyncState,
  upsertCalendarConnection,
  upsertExternalCalendarSource,
  upsertExternalEventLink,
} from "../../db/calendar-intelligence-repository";
import {
  getCanonicalCalendarEvent,
  markImportedCalendarEventDeleted,
  setCalendarEventConflictState,
  upsertImportedCalendarEvent,
} from "../../db/time-repository";
import type { CalendarEventInput, TimePreferences } from "../time/types";
import {
  addDays,
  localDateInZone,
  localTimeInZone,
} from "../time/rules";
import {
  decryptSecret,
  encryptSecret,
  googleCalendarConfiguration,
} from "./calendar-secrets";

const GOOGLE_API = "https://www.googleapis.com/calendar/v3";

export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
] as const;

type GoogleCalendarListEntry = {
  id: string;
  summary?: string;
  primary?: boolean;
  selected?: boolean;
  accessRole?: "none" | "freeBusyReader" | "reader" | "writer" | "owner";
  timeZone?: string;
};

type GoogleCalendarEvent = {
  id: string;
  etag?: string;
  status?: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  description?: string;
  location?: string;
  visibility?: "default" | "public" | "private" | "confidential";
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  recurringEventId?: string;
  iCalUID?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
  };
  organizer?: { email?: string; displayName?: string; self?: boolean };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: string;
    self?: boolean;
  }>;
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{ method?: string; minutes?: number }>;
  };
  updated?: string;
};

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: "Bearer";
  id_token?: string;
};

export class GoogleCalendarError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "GoogleCalendarError";
  }
}

function cleanExternalText(value: string | undefined, maximum: number) {
  return (value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .slice(0, maximum)
    .trim();
}

async function eventHash(event: CalendarEventInput) {
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      title: event.title,
      notes: event.notes,
      location: event.location,
      meetingUrl: event.meetingUrl,
      status: event.status,
      allDay: event.allDay,
      localDate: event.localDate,
      endLocalDate: event.endLocalDate,
      startTime: event.startTime,
      endTime: event.endTime,
      timeZone: event.timeZone,
    }),
  );
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function differences(
  local: CalendarEventInput,
  provider: CalendarEventInput,
) {
  const keys: Array<keyof CalendarEventInput> = [
    "title",
    "notes",
    "location",
    "meetingUrl",
    "status",
    "allDay",
    "localDate",
    "endLocalDate",
    "startTime",
    "endTime",
    "timeZone",
  ];
  return keys.filter(
    (key) => JSON.stringify(local[key]) !== JSON.stringify(provider[key]),
  ) as string[];
}

function eventType(event: GoogleCalendarEvent): CalendarEventInput["eventType"] {
  const text = `${event.summary ?? ""} ${event.description ?? ""}`.toLowerCase();
  if (/\bbirthday\b/.test(text)) return "birthday";
  if (/\b(dentist|doctor|medical|clinic)\b/.test(text)) return "medical";
  if (/\b(workout|gym|training|run)\b/.test(text)) return "workout";
  if (event.attendees?.length || event.hangoutLink) return "meeting";
  return "personal";
}

export function googleEventToCalendarInput(
  event: GoogleCalendarEvent,
  fallbackTimeZone: string,
): CalendarEventInput {
  const allDay = Boolean(event.start?.date);
  const timeZone =
    event.start?.timeZone ?? event.end?.timeZone ?? fallbackTimeZone;
  const localDate = allDay
    ? event.start?.date
    : event.start?.dateTime
      ? localDateInZone(event.start.dateTime, timeZone)
      : null;
  const endLocalDate = allDay
    ? event.end?.date
      ? addDays(event.end.date, -1)
      : localDate
    : event.end?.dateTime
      ? localDateInZone(event.end.dateTime, timeZone)
      : localDate;
  if (!localDate || !endLocalDate) {
    throw new GoogleCalendarError(
      "Google returned an event without a supported start or end.",
      422,
    );
  }
  const meetingUrl =
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find(
      (entry) => entry.entryPointType === "video",
    )?.uri ??
    "";
  return {
    title: cleanExternalText(event.summary, 160) || "Busy",
    eventType: eventType(event),
    notes:
      event.visibility === "private"
        ? ""
        : cleanExternalText(event.description, 4_000),
    location: cleanExternalText(event.location, 240),
    provider: "Google Calendar",
    meetingUrl: cleanExternalText(meetingUrl, 240),
    amount: null,
    currency: "USD",
    paymentStatus: null,
    priority: "standard",
    status:
      event.status === "cancelled"
        ? "cancelled"
        : event.status === "tentative"
          ? "scheduled"
          : "scheduled",
    allDay,
    localDate,
    endLocalDate,
    startTime:
      !allDay && event.start?.dateTime
        ? localTimeInZone(event.start.dateTime, timeZone)
        : null,
    endTime:
      !allDay && event.end?.dateTime
        ? localTimeInZone(event.end.dateTime, timeZone)
        : null,
    timeZone,
    recurrence: null,
    reminderOffsets: (event.reminders?.overrides ?? [])
      .flatMap((reminder) =>
        Number.isInteger(reminder.minutes) ? [reminder.minutes!] : [],
      )
      .slice(0, 5),
    relationship: "",
    birthYear: null,
    giftIdea: "",
    contactMethod: "",
    billCategory: "",
    autopay: false,
    accountNote:
      event.visibility === "private"
        ? "Provider marked this event private."
        : "",
    paidAt: null,
    escalationEnabled: true,
    sensitive:
      event.visibility === "private" || event.visibility === "confidential",
  };
}

function calendarInputToGoogleEvent(event: CalendarEventInput) {
  return {
    summary: event.title,
    description: event.notes || undefined,
    location: event.location || undefined,
    status: event.status === "cancelled" ? "cancelled" : "confirmed",
    start: event.allDay
      ? { date: event.localDate }
      : {
          dateTime: `${event.localDate}T${event.startTime}:00`,
          timeZone: event.timeZone,
        },
    end: event.allDay
      ? { date: addDays(event.endLocalDate, 1) }
      : {
          dateTime: `${event.endLocalDate}T${event.endTime}:00`,
          timeZone: event.timeZone,
        },
    reminders: event.reminderOffsets.length
      ? {
          useDefault: false,
          overrides: event.reminderOffsets.map((minutes) => ({
            method: "popup",
            minutes,
          })),
        }
      : { useDefault: true },
  };
}

export function googleAuthorizationUrl(input: {
  redirectUri: string;
  state: string;
}) {
  const configuration = googleCalendarConfiguration();
  if (!configuration.configured) {
    throw new Error(
      configuration.reasonUnavailable ?? "Google Calendar is not configured.",
    );
  }
  const parameters = new URLSearchParams({
    client_id: configuration.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state: input.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${parameters}`;
}

export async function exchangeGoogleAuthorizationCode(input: {
  code: string;
  redirectUri: string;
}) {
  const configuration = googleCalendarConfiguration();
  if (!configuration.configured) {
    throw new Error(
      configuration.reasonUnavailable ?? "Google Calendar is not configured.",
    );
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: configuration.clientId,
      client_secret: configuration.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) {
    throw new GoogleCalendarError(
      "Google authorization could not be completed.",
      response.status,
    );
  }
  return (await response.json()) as TokenResponse;
}

async function refreshAccessToken(connectionId: string) {
  const configuration = googleCalendarConfiguration();
  const credential = await getCalendarConnectionCredential(connectionId);
  if (!credential) throw new Error("Calendar connection was not found.");
  if (
    credential.encrypted_access_token &&
    credential.token_expires_at &&
    Date.parse(credential.token_expires_at) > Date.now() + 60_000
  ) {
    return decryptSecret(credential.encrypted_access_token);
  }
  if (!credential.encrypted_refresh_token) {
    await updateConnectionHealth(
      connectionId,
      "attention",
      "Google needs to be reconnected.",
    );
    throw new GoogleCalendarError("Google needs to be reconnected.", 401);
  }
  const refreshToken = await decryptSecret(credential.encrypted_refresh_token);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: configuration.clientId,
      client_secret: configuration.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    await updateConnectionHealth(
      connectionId,
      "attention",
      "Google needs to be reconnected.",
    );
    throw new GoogleCalendarError("Google needs to be reconnected.", 401);
  }
  const token = (await response.json()) as TokenResponse;
  const expiresAt = new Date(
    Date.now() + token.expires_in * 1_000,
  ).toISOString();
  await updateConnectionCredential(
    connectionId,
    await encryptSecret(token.access_token),
    expiresAt,
  );
  return token.access_token;
}

async function googleFetch<T>(
  connectionId: string,
  path: string,
  init: RequestInit = {},
) {
  const accessToken = await refreshAccessToken(connectionId);
  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${GOOGLE_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    lastResponse = response;
    if (response.ok) {
      if (response.status === 204) return null as T;
      return (await response.json()) as T;
    }
    if (![429, 500, 502, 503, 504].includes(response.status)) {
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      throw new GoogleCalendarError(
        payload?.error?.message ??
          `Google Calendar returned ${response.status}.`,
        response.status,
      );
    }
    if (attempt < 2) {
      const retryAfter = Math.min(
        Number(response.headers.get("Retry-After") ?? attempt + 1),
        2,
      );
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1_000));
    }
  }
  throw new GoogleCalendarError(
    "Google Calendar is temporarily unavailable.",
    lastResponse?.status ?? 503,
  );
}

export async function connectGoogleCalendar(input: {
  token: TokenResponse;
  preferences: TimePreferences;
}) {
  const user = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${input.token.access_token}` },
  });
  if (!user.ok) {
    throw new GoogleCalendarError(
      "Google account identity could not be verified.",
      user.status,
    );
  }
  const identity = (await user.json()) as {
    sub: string;
    email: string;
    name?: string;
  };
  const connectionId = await upsertCalendarConnection({
    provider: "google",
    accountId: identity.sub,
    accountEmail: identity.email,
    displayName: identity.name ?? identity.email,
    encryptedAccessToken: await encryptSecret(input.token.access_token),
    encryptedRefreshToken: input.token.refresh_token
      ? await encryptSecret(input.token.refresh_token)
      : null,
    tokenExpiresAt: new Date(
      Date.now() + input.token.expires_in * 1_000,
    ).toISOString(),
    scopes: (input.token.scope ?? GOOGLE_CALENDAR_SCOPES.join(" ")).split(" "),
  });
  const calendars = await googleFetch<{ items?: GoogleCalendarListEntry[] }>(
    connectionId,
    "/users/me/calendarList?minAccessRole=reader&showHidden=false",
  );
  let primarySourceId: string | null = null;
  for (const calendar of calendars.items ?? []) {
    const writable = ["writer", "owner"].includes(calendar.accessRole ?? "");
    const sourceId = await upsertExternalCalendarSource({
      connectionId,
      provider: "google",
      externalCalendarId: calendar.id,
      displayName: cleanExternalText(calendar.summary, 120) || "Google Calendar",
      access: writable ? "write" : "read",
      visible: Boolean(calendar.primary),
      includeInAvailability: Boolean(calendar.primary),
      includeInAtlas: Boolean(calendar.primary),
      isDefault: Boolean(calendar.primary && writable),
    });
    if (calendar.primary) primarySourceId = sourceId;
  }
  await recordCalendarAudit({
    actor: "owner",
    action: "connect",
    source: "google",
    eventIds: [],
    summary: `Connected Google Calendar for ${identity.email}.`,
    providerResult: "confirmed",
  });
  if (primarySourceId) {
    await syncGoogleSource(primarySourceId, input.preferences);
  }
  return connectionId;
}

async function syncEvent(
  sourceId: string,
  event: GoogleCalendarEvent,
  source: Awaited<ReturnType<typeof getCalendarSource>>,
  preferences: TimePreferences,
  syncedAt: string,
) {
  if (!source || !source.externalCalendarId) return;
  const link = await getExternalEventLinkByExternal(sourceId, event.id);
  if (event.status === "cancelled") {
    if (link) {
      await markImportedCalendarEventDeleted(link.local_event_id, syncedAt);
      await upsertExternalEventLink({
        ...link,
        sourceId,
        localEventId: link.local_event_id,
        externalEventId: event.id,
        externalSeriesId: event.recurringEventId ?? null,
        providerVersion: event.etag ?? null,
        lastSyncedHash: link.last_synced_hash,
        lastLocalVersion: link.last_local_version,
        direction: "pull",
        pendingAction: null,
      });
    }
    return;
  }
  const mapped = googleEventToCalendarInput(event, preferences.timeZone);
  const remoteHash = await eventHash(mapped);
  const localId =
    link?.local_event_id ?? `google:${sourceId}:${encodeURIComponent(event.id)}`;
  const canonical = link ? await getCanonicalCalendarEvent(localId) : null;
  if (
    link &&
    canonical &&
    canonical.localVersion > link.last_local_version &&
    link.last_synced_hash &&
    link.last_synced_hash !== remoteHash
  ) {
    const fields = differences(canonical.input, mapped);
    if (fields.length) {
      await recordSyncConflict({
        linkId: link.id,
        localEventId: localId,
        sourceId,
        differingFields: fields,
        localVersion: canonical.input,
        providerVersion: mapped,
      });
      await setCalendarEventConflictState(localId, "local-newer");
      return;
    }
  }
  await upsertImportedCalendarEvent({
    id: localId,
    event: mapped,
    sourceId,
    externalCalendarId: source.externalCalendarId,
    remoteVersion: event.etag ?? null,
    readOnly: source.access === "read",
    syncedAt,
  });
  const refreshed = await getCanonicalCalendarEvent(localId);
  await upsertExternalEventLink({
    sourceId,
    localEventId: localId,
    externalEventId: event.id,
    externalSeriesId: event.recurringEventId ?? null,
    providerVersion: event.etag ?? null,
    lastSyncedHash: remoteHash,
    lastLocalVersion: refreshed?.localVersion ?? 1,
    direction: "pull",
    pendingAction: null,
  });
}

export async function syncGoogleSource(
  sourceId: string,
  preferences: TimePreferences,
) {
  const source = await getCalendarSource(sourceId);
  if (
    !source ||
    source.provider !== "google" ||
    !source.connectionId ||
    !source.externalCalendarId
  ) {
    throw new Error("Google Calendar source was not found.");
  }
  await updateSourceSyncState(
    sourceId,
    "syncing",
    await getSourceSyncCursor(sourceId),
    source.lastSyncedAt,
  );
  const syncedAt = new Date().toISOString();
  let cursor = await getSourceSyncCursor(sourceId);
  let resetAttempted = false;
  let pageToken: string | null = null;
  let nextSyncToken: string | null = null;
  try {
    do {
      const parameters = new URLSearchParams({
        maxResults: "250",
        showDeleted: "true",
        singleEvents: "true",
      });
      if (cursor) {
        parameters.set("syncToken", cursor);
      } else {
        parameters.set(
          "timeMin",
          new Date(Date.now() - 365 * 24 * 60 * 60_000).toISOString(),
        );
        parameters.set(
          "timeMax",
          new Date(Date.now() + 730 * 24 * 60 * 60_000).toISOString(),
        );
      }
      if (pageToken) parameters.set("pageToken", pageToken);
      let response: {
        items?: GoogleCalendarEvent[];
        nextPageToken?: string;
        nextSyncToken?: string;
      };
      try {
        response = await googleFetch(
          source.connectionId,
          `/calendars/${encodeURIComponent(
            source.externalCalendarId,
          )}/events?${parameters}`,
        );
      } catch (error) {
        if (
          error instanceof GoogleCalendarError &&
          error.status === 410 &&
          cursor &&
          !resetAttempted
        ) {
          cursor = null;
          pageToken = null;
          resetAttempted = true;
          continue;
        }
        throw error;
      }
      for (const event of response.items ?? []) {
        await syncEvent(sourceId, event, source, preferences, syncedAt);
      }
      pageToken = response.nextPageToken ?? null;
      nextSyncToken = response.nextSyncToken ?? nextSyncToken;
    } while (pageToken);
    await updateSourceSyncState(
      sourceId,
      "healthy",
      nextSyncToken ?? cursor,
      syncedAt,
    );
    await updateConnectionHealth(
      source.connectionId,
      "healthy",
      null,
      syncedAt,
    );
    return { sourceId, syncedAt };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Google sync failed.";
    await updateSourceSyncState(sourceId, "attention", cursor, source.lastSyncedAt);
    await updateConnectionHealth(
      source.connectionId,
      "attention",
      message,
    );
    throw error;
  }
}

export async function syncGoogleConnection(
  connectionId: string,
  preferences: TimePreferences,
) {
  const sources = await listCalendarSources();
  const eligible = sources.filter(
    (source) =>
      source.connectionId === connectionId &&
      source.provider === "google" &&
      source.visible,
  );
  const results = [];
  for (const source of eligible) {
    results.push(await syncGoogleSource(source.id, preferences));
  }
  await recordCalendarAudit({
    actor: "owner",
    action: "sync",
    source: "google",
    eventIds: [],
    summary: `Synchronized ${results.length} visible Google calendar${
      results.length === 1 ? "" : "s"
    }.`,
    providerResult: "confirmed",
  });
  return results;
}

export async function pushCalendarEventUpdate(localEventId: string) {
  const link = await getExternalEventLinkByLocal(localEventId);
  if (!link) return null;
  const source = await getCalendarSource(link.source_id);
  const canonical = await getCanonicalCalendarEvent(localEventId);
  if (
    !source ||
    source.provider !== "google" ||
    !source.connectionId ||
    !source.externalCalendarId ||
    !canonical
  ) {
    return null;
  }
  if (source.access !== "write" || canonical.readOnly) {
    throw new Error("This provider calendar is read-only.");
  }
  await markExternalLinkPending(localEventId, "update");
  try {
    const remote = await googleFetch<GoogleCalendarEvent>(
      source.connectionId,
      `/calendars/${encodeURIComponent(
        source.externalCalendarId,
      )}/events/${encodeURIComponent(link.external_event_id)}`,
      {
        method: "PATCH",
        headers: link.provider_version
          ? { "If-Match": link.provider_version }
          : undefined,
        body: JSON.stringify(calendarInputToGoogleEvent(canonical.input)),
      },
    );
    const mapped = googleEventToCalendarInput(
      remote,
      canonical.input.timeZone,
    );
    await upsertExternalEventLink({
      ...link,
      sourceId: source.id,
      localEventId,
      externalEventId: remote.id,
      externalSeriesId: remote.recurringEventId ?? null,
      providerVersion: remote.etag ?? null,
      lastSyncedHash: await eventHash(mapped),
      lastLocalVersion: canonical.localVersion,
      direction: "push",
      pendingAction: null,
    });
    return remote;
  } catch (error) {
    if (error instanceof GoogleCalendarError && error.status === 412) {
      await setCalendarEventConflictState(localEventId, "local-newer");
      await recordSyncConflict({
        linkId: link.id,
        localEventId,
        sourceId: source.id,
        differingFields: ["provider version"],
        localVersion: canonical.input,
        providerVersion: {},
      });
    }
    throw error;
  }
}

export async function createGoogleCalendarEvent(
  sourceId: string,
  event: CalendarEventInput,
) {
  const source = await getCalendarSource(sourceId);
  if (
    !source ||
    source.provider !== "google" ||
    source.access !== "write" ||
    !source.connectionId ||
    !source.externalCalendarId
  ) {
    throw new Error("The selected Google calendar is not writable.");
  }
  const remote = await googleFetch<GoogleCalendarEvent>(
    source.connectionId,
    `/calendars/${encodeURIComponent(source.externalCalendarId)}/events`,
    {
      method: "POST",
      body: JSON.stringify(calendarInputToGoogleEvent(event)),
    },
  );
  const syncedAt = new Date().toISOString();
  const localId = `google:${sourceId}:${encodeURIComponent(remote.id)}`;
  const mapped = googleEventToCalendarInput(remote, event.timeZone);
  await upsertImportedCalendarEvent({
    id: localId,
    event: mapped,
    sourceId,
    externalCalendarId: source.externalCalendarId,
    remoteVersion: remote.etag ?? null,
    readOnly: false,
    syncedAt,
  });
  const canonical = await getCanonicalCalendarEvent(localId);
  await upsertExternalEventLink({
    sourceId,
    localEventId: localId,
    externalEventId: remote.id,
    externalSeriesId: remote.recurringEventId ?? null,
    providerVersion: remote.etag ?? null,
    lastSyncedHash: await eventHash(mapped),
    lastLocalVersion: canonical?.localVersion ?? 1,
    direction: "push",
    pendingAction: null,
  });
  return { localId, remote };
}

export async function deleteGoogleCalendarEvent(localEventId: string) {
  const link = await getExternalEventLinkByLocal(localEventId);
  if (!link) return null;
  const source = await getCalendarSource(link.source_id);
  if (
    !source ||
    source.provider !== "google" ||
    source.access !== "write" ||
    !source.connectionId ||
    !source.externalCalendarId
  ) {
    throw new Error("The selected Google calendar is not writable.");
  }
  await markExternalLinkPending(localEventId, "delete");
  await googleFetch(
    source.connectionId,
    `/calendars/${encodeURIComponent(
      source.externalCalendarId,
    )}/events/${encodeURIComponent(link.external_event_id)}`,
    {
      method: "DELETE",
      headers: link.provider_version
        ? { "If-Match": link.provider_version }
        : undefined,
    },
  );
  await markExternalLinkPending(localEventId, null);
  return true;
}

export async function revokeGoogleConnection(connectionId: string) {
  const credential = await getCalendarConnectionCredential(connectionId);
  if (!credential) return;
  const encrypted =
    credential.encrypted_refresh_token || credential.encrypted_access_token;
  if (!encrypted) return;
  try {
    const token = await decryptSecret(encrypted);
    await fetch(
      `https://oauth2.googleapis.com/revoke?${new URLSearchParams({ token })}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );
  } catch {
    // Local credential removal still proceeds; the UI reports only confirmed
    // local disconnection and never claims remote revocation succeeded.
  }
}

export async function resolveGoogleSyncConflict(
  conflictId: string,
  resolution: "nexus" | "provider" | "merged",
  mergedEvent?: CalendarEventInput,
) {
  const conflict = await getSyncConflict(conflictId);
  if (!conflict || conflict.status !== "open") {
    throw new Error("Sync conflict was not found.");
  }
  const link = await getExternalEventLinkById(conflict.linkId);
  const source = await getCalendarSource(conflict.sourceId);
  if (
    !link ||
    !source ||
    source.provider !== "google" ||
    !source.connectionId ||
    !source.externalCalendarId
  ) {
    throw new Error("The Google source for this conflict is unavailable.");
  }
  const currentRemote = await googleFetch<GoogleCalendarEvent>(
    source.connectionId,
    `/calendars/${encodeURIComponent(
      source.externalCalendarId,
    )}/events/${encodeURIComponent(link.external_event_id)}`,
  );
  const providerEvent = googleEventToCalendarInput(
    currentRemote,
    (await getCanonicalCalendarEvent(conflict.localEventId))?.input.timeZone ??
      "UTC",
  );
  let resolvedEvent = providerEvent;
  if (resolution !== "provider") {
    const canonical = await getCanonicalCalendarEvent(conflict.localEventId);
    if (!canonical) throw new Error("The local event no longer exists.");
    resolvedEvent = resolution === "merged" && mergedEvent ? mergedEvent : canonical.input;
    const updated = await googleFetch<GoogleCalendarEvent>(
      source.connectionId,
      `/calendars/${encodeURIComponent(
        source.externalCalendarId,
      )}/events/${encodeURIComponent(link.external_event_id)}`,
      {
        method: "PATCH",
        headers: currentRemote.etag
          ? { "If-Match": currentRemote.etag }
          : undefined,
        body: JSON.stringify(calendarInputToGoogleEvent(resolvedEvent)),
      },
    );
    resolvedEvent = googleEventToCalendarInput(
      updated,
      resolvedEvent.timeZone,
    );
    currentRemote.etag = updated.etag;
  }
  const syncedAt = new Date().toISOString();
  await upsertImportedCalendarEvent({
    id: conflict.localEventId,
    event: resolvedEvent,
    sourceId: source.id,
    externalCalendarId: source.externalCalendarId,
    remoteVersion: currentRemote.etag ?? null,
    readOnly: source.access === "read",
    syncedAt,
  });
  const canonical = await getCanonicalCalendarEvent(conflict.localEventId);
  await upsertExternalEventLink({
    ...link,
    sourceId: source.id,
    localEventId: conflict.localEventId,
    externalEventId: link.external_event_id,
    externalSeriesId: link.external_series_id,
    providerVersion: currentRemote.etag ?? null,
    lastSyncedHash: await eventHash(resolvedEvent),
    lastLocalVersion: canonical?.localVersion ?? link.last_local_version,
    direction: resolution === "provider" ? "pull" : "push",
    pendingAction: null,
  });
  await setCalendarEventConflictState(conflict.localEventId, "none");
  await resolveSyncConflict(conflictId, resolution);
  await recordCalendarAudit({
    actor: "owner",
    action: "resolve-conflict",
    source: "google",
    eventIds: [conflict.localEventId],
    summary:
      resolution === "provider"
        ? "Resolved a sync conflict with the Google version."
        : resolution === "nexus"
          ? "Resolved a sync conflict with the Nexus version."
          : "Resolved a sync conflict with reviewed merged fields.",
    providerResult: "confirmed",
  });
  return resolvedEvent;
}
