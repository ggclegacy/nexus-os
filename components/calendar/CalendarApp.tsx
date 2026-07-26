"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bell,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Filter,
  List,
  Pause,
  Pencil,
  Plus,
  RefreshCw,
  Repeat2,
  RotateCcw,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "../shell/AppShell";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import {
  ConnectionNotice,
  EmptyState,
  ErrorState,
  SkeletonLines,
} from "../ui/Feedback";
import { Panel, SectionHeader } from "../ui/Panel";
import { ToastRegion, type ToastMessage } from "../ui/Toast";
import {
  ApiConflictError,
  timeApi,
  type TimeApi,
} from "../../lib/client/time-api";
import type {
  Priority,
  PriorityInput,
  PriorityUpdate,
} from "../../lib/domain/types";
import {
  addDays,
  dateRange,
  endOfWeek,
  isInQuietHours,
  localDateInZone,
  localTimeInZone,
  recurrenceLabel,
  startOfWeek,
  zonedDateTimeToUtc,
} from "../../lib/time/rules";
import type {
  CalendarEvent,
  CalendarEventInput,
  CalendarFilters,
  CalendarPayload,
  RecurrenceEditScope,
  RecurrenceRule,
  Routine,
  RoutineInput,
  RoutineOccurrence,
  TimeArea,
  TimePreferences,
} from "../../lib/time/types";

type Editor =
  | { type: "event"; item?: CalendarEvent; startTime?: string }
  | { type: "priority"; item?: Priority }
  | { type: "routine"; item?: Routine }
  | { type: "preferences" }
  | { type: "quick" }
  | null;

type ScopeAction =
  | {
      kind: "save";
      item: CalendarEvent;
      input: CalendarEventInput;
    }
  | { kind: "delete"; item: CalendarEvent }
  | null;

type ConflictAction = {
  item?: CalendarEvent;
  input: CalendarEventInput;
  scope: RecurrenceEditScope;
  conflicts: ApiConflictError["conflicts"];
} | null;

const defaultFilters: CalendarFilters = {
  query: "",
  includeEvents: true,
  includePriorities: true,
  includeRoutines: true,
  includeCompleted: true,
};

function detectedTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function todayKey() {
  return localDateInZone(new Date(), detectedTimeZone());
}

function initialArea(): TimeArea {
  if (typeof window === "undefined") return "agenda";
  const value = new URLSearchParams(window.location.search).get("view");
  return ["agenda", "day", "week", "priorities", "routines"].includes(
    value ?? "",
  )
    ? (value as TimeArea)
    : "agenda";
}

function initialDate() {
  if (typeof window === "undefined") return todayKey();
  const value = new URLSearchParams(window.location.search).get("date");
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayKey();
}

function formatDate(
  value: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
  },
) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    ...options,
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatTime(value: string | null, hourCycle: "12" | "24" = "12") {
  if (!value) return "Any time";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: hourCycle === "24" ? "h23" : "h12",
  }).format(new Date(value));
}

function eventTime(event: CalendarEvent, hourCycle: "12" | "24") {
  if (event.allDay) {
    return event.endLocalDate > event.localDate
      ? `All day · through ${formatDate(event.endLocalDate, {
          month: "short",
          day: "numeric",
        })}`
      : "All day";
  }
  return `${formatTime(event.startAt, hourCycle)}–${formatTime(
    event.endAt,
    hourCycle,
  )}`;
}

function areaRange(area: TimeArea, cursor: string, weekStartsOn: 0 | 1) {
  if (area === "day") return { start: cursor, end: cursor };
  if (area === "week") {
    return {
      start: startOfWeek(cursor, weekStartsOn),
      end: endOfWeek(cursor, weekStartsOn),
    };
  }
  if (area === "agenda") return { start: cursor, end: addDays(cursor, 13) };
  return { start: addDays(cursor, -30), end: addDays(cursor, 60) };
}

function eventOverlapsDate(event: CalendarEvent, date: string) {
  return event.localDate <= date && event.endLocalDate >= date;
}

function currentTimePosition(now: Date, timeZone: string) {
  const [hour, minute] = localTimeInZone(now, timeZone).split(":").map(Number);
  const minutes = hour * 60 + minute;
  const gridStart = 6 * 60;
  const gridEnd = 23 * 60;
  if (minutes < gridStart || minutes > gridEnd) return null;
  return ((minutes - gridStart) / (gridEnd - gridStart)) * 100;
}

export function CalendarApp({ api = timeApi }: { api?: TimeApi }) {
  const [area, setArea] = useState<TimeArea>(initialArea);
  const [cursor, setCursor] = useState(initialDate);
  const [filters, setFilters] = useState(defaultFilters);
  const [data, setData] = useState<CalendarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [editor, setEditor] = useState<Editor>(null);
  const [scopeAction, setScopeAction] = useState<ScopeAction>(null);
  const [conflictAction, setConflictAction] = useState<ConflictAction>(null);
  const [noteOccurrence, setNoteOccurrence] =
    useState<RoutineOccurrence | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const weekStartsOn = data?.preferences.weekStartsOn ?? 1;
  const range = useMemo(
    () => areaRange(area, cursor, weekStartsOn),
    [area, cursor, weekStartsOn],
  );

  const notify = useCallback(
    (message: string, action?: Omit<ToastMessage, "id" | "message">) => {
      setToast({ id: crypto.randomUUID(), message, ...action });
    },
    [],
  );

  const load = useCallback(
    async (initial = false, signal?: AbortSignal) => {
      if (initial) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        setData(
          await api.load(
            range.start,
            range.end,
            filters,
            signal,
            detectedTimeZone(),
          ),
        );
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        )
          return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Personal time could not be loaded.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api, filters, range.end, range.start],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void load(true, controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  useEffect(() => {
    const updateConnection = () => setOffline(!navigator.onLine);
    const updateNow = () => setNow(new Date());
    const pop = () => {
      setArea(initialArea());
      setCursor(initialDate());
    };
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    window.addEventListener("popstate", pop);
    const timer = window.setInterval(updateNow, 60_000);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
      window.removeEventListener("popstate", pop);
      window.clearInterval(timer);
    };
  }, []);

  const navigateTo = (nextArea: TimeArea, nextDate = cursor) => {
    setArea(nextArea);
    setCursor(nextDate);
    const params = new URLSearchParams(window.location.search);
    params.set("view", nextArea);
    params.set("date", nextDate);
    window.history.pushState({}, "", `/calendar?${params}`);
  };

  const stepDate = (direction: -1 | 1) => {
    const amount = area === "week" ? 7 : area === "agenda" ? 14 : 1;
    navigateTo(area, addDays(cursor, direction * amount));
  };

  const refresh = async () => {
    await load(false);
  };

  const saveEvent = async (
    input: CalendarEventInput,
    item?: CalendarEvent,
    scope: RecurrenceEditScope = "series",
    acknowledgeConflict = false,
  ) => {
    if (offline) {
      throw new Error(
        "You are offline. This event remains in the form and has not been saved.",
      );
    }
    try {
      if (item) {
        await api.updateEvent(
          item.id,
          item.occurrenceDate,
          scope,
          input,
          acknowledgeConflict,
        );
      } else {
        await api.createEvent(input, acknowledgeConflict);
      }
      setEditor(null);
      setScopeAction(null);
      setConflictAction(null);
      notify(item ? "Event updated." : "Event added.");
      await refresh();
    } catch (saveError) {
      if (saveError instanceof ApiConflictError) {
        setConflictAction({
          item,
          input,
          scope,
          conflicts: saveError.conflicts,
        });
        return;
      }
      throw saveError;
    }
  };

  const requestSaveEvent = (
    input: CalendarEventInput,
    item?: CalendarEvent,
  ) => {
    if (item?.seriesId) {
      setScopeAction({ kind: "save", item, input });
      return;
    }
    return saveEvent(input, item);
  };

  const requestDeleteEvent = (item: CalendarEvent) => {
    setScopeAction({ kind: "delete", item });
  };

  const applyScope = async (scope: RecurrenceEditScope) => {
    if (!scopeAction) return;
    if (offline) {
      notify("Offline. The event was not changed.");
      return;
    }
    if (scopeAction.kind === "save") {
      try {
        await saveEvent(scopeAction.input, scopeAction.item, scope);
      } catch (scopeError) {
        notify(
          scopeError instanceof Error
            ? scopeError.message
            : "The recurring event was not changed.",
        );
      }
      return;
    }
    try {
      const item = scopeAction.item;
      await api.deleteEvent(item.id, item.occurrenceDate, scope);
      setScopeAction(null);
      notify(
        scope === "occurrence"
          ? "This occurrence was removed."
          : scope === "future"
            ? "This and future occurrences were removed."
            : "The entire series was removed.",
      );
      await refresh();
    } catch (deleteError) {
      notify(
        deleteError instanceof Error
          ? deleteError.message
          : "The event was not removed.",
      );
    }
  };

  const savePriority = async (input: PriorityInput, item?: Priority) => {
    if (offline) {
      throw new Error(
        "You are offline. This priority remains in the form and has not been saved.",
      );
    }
    if (item) await api.updatePriority(item.id, input);
    else await api.createPriority(input);
    setEditor(null);
    notify(item ? "Priority updated." : "Priority added.");
    await refresh();
  };

  const changePriority = async (item: Priority, update: PriorityUpdate) => {
    if (offline) {
      notify(
        "Offline. Priority changes are blocked until the connection returns.",
      );
      return;
    }
    try {
      await api.updatePriority(item.id, update);
      notify("Priority updated.");
      await refresh();
    } catch (changeError) {
      notify(
        changeError instanceof Error
          ? changeError.message
          : "The priority was not changed.",
      );
    }
  };

  const removePriority = async (item: Priority) => {
    if (offline) {
      notify("Offline. The priority was not removed.");
      return;
    }
    try {
      await api.deletePriority(item.id);
      notify("Priority removed.", {
        actionLabel: "Undo",
        onAction: async () => {
          await api.createPriority({
            title: item.title,
            notes: item.notes,
            dueAt: item.dueAt,
            isTop: item.isTop,
            scheduledStartAt: item.scheduledStartAt,
            scheduledEndAt: item.scheduledEndAt,
            reminderEnabled: item.reminderEnabled,
            reminderOffsetMinutes: item.reminderOffsetMinutes,
          });
          await refresh();
        },
      });
      await refresh();
    } catch (removeError) {
      notify(
        removeError instanceof Error
          ? removeError.message
          : "The priority was not removed.",
      );
    }
  };

  const moveTopPriority = async (item: Priority, direction: -1 | 1) => {
    if (offline) {
      notify("Offline. Priority order was not changed.");
      return;
    }
    const top = (data?.priorities ?? [])
      .filter(
        (priority) => priority.status === "active" && priority.isTop !== false,
      )
      .sort((a, b) => a.position - b.position);
    const index = top.findIndex((priority) => priority.id === item.id);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= top.length) return;
    [top[index], top[nextIndex]] = [top[nextIndex], top[index]];
    try {
      await api.reorderPriorities(top.map((priority) => priority.id));
      notify("Top three reordered.");
      await refresh();
    } catch (moveError) {
      notify(
        moveError instanceof Error
          ? moveError.message
          : "Priority order was not changed.",
      );
    }
  };

  const saveRoutine = async (input: RoutineInput, item?: Routine) => {
    if (offline) {
      throw new Error(
        "You are offline. This routine remains in the form and has not been saved.",
      );
    }
    if (item) await api.updateRoutine(item.id, input);
    else await api.createRoutine(input);
    setEditor(null);
    notify(
      item ? "Routine updated. Past history was preserved." : "Routine added.",
    );
    await refresh();
  };

  const changeRoutineState = async (item: Routine, state: Routine["state"]) => {
    if (offline) {
      notify("Offline. The routine state was not changed.");
      return;
    }
    try {
      await api.updateRoutine(item.id, { ...item, state });
      notify(
        state === "paused"
          ? "Routine paused. Its history remains intact."
          : state === "active"
            ? "Routine resumed."
            : "Routine archived. Its history remains available.",
      );
      await refresh();
    } catch (stateError) {
      notify(
        stateError instanceof Error
          ? stateError.message
          : "The routine state was not changed.",
      );
    }
  };

  const changeOccurrence = async (
    occurrence: RoutineOccurrence,
    status: "upcoming" | "due" | "completed" | "skipped",
    note = occurrence.note,
  ) => {
    if (offline) {
      notify("Offline. The routine occurrence was not changed.");
      throw new Error("The routine occurrence was not changed while offline.");
    }
    try {
      await api.updateOccurrence(
        occurrence.routineId,
        occurrence.scheduledDate,
        status,
        note,
      );
      notify(
        status === "completed"
          ? "Routine marked complete."
          : status === "skipped"
            ? "Routine skipped without penalty."
            : "Routine status restored.",
      );
      await refresh();
    } catch (occurrenceError) {
      notify(
        occurrenceError instanceof Error
          ? occurrenceError.message
          : "The routine occurrence was not changed.",
      );
      throw occurrenceError;
    }
  };
  const safelyChangeOccurrence = (
    occurrence: RoutineOccurrence,
    status: "due" | "completed" | "skipped",
  ) => {
    void changeOccurrence(occurrence, status).catch(() => {
      // changeOccurrence already reports the failure without changing data.
    });
  };

  const savePreferences = async (preferences: TimePreferences) => {
    if (offline) {
      throw new Error(
        "You are offline. These preferences remain in the form and have not been saved.",
      );
    }
    await api.updatePreferences(preferences);
    setEditor(null);
    notify("Time and reminder preferences saved.");
    await refresh();
  };

  const stale =
    data !== null &&
    now.getTime() - Date.parse(data.lastUpdatedAt) > 5 * 60 * 1000;

  return (
    <AppShell onQuickAdd={() => setEditor({ type: "quick" })}>
      <ConnectionNotice offline={offline} stale={stale} />
      <div className="time-page">
        <TimeHeader
          area={area}
          cursor={cursor}
          range={range}
          refreshing={refreshing}
          sourceLabel={data?.sourceLabel}
          onArea={(next) => navigateTo(next)}
          onPrevious={() => stepDate(-1)}
          onNext={() => stepDate(1)}
          onToday={() => navigateTo(area, todayKey())}
          onRefresh={() => void refresh()}
          onAdd={() => setEditor({ type: "quick" })}
          onPreferences={() => setEditor({ type: "preferences" })}
        />

        <TimeFilters filters={filters} onChange={setFilters} />

        {data ? <ReminderNotice data={data} now={now} /> : null}

        {error && !data ? (
          <Panel>
            <ErrorState
              title="Personal time is unavailable"
              detail={`${error} Your existing records were not changed.`}
              onRetry={() => void load(true)}
            />
          </Panel>
        ) : loading || !data ? (
          <TimeSkeleton />
        ) : (
          <>
            {error ? (
              <div className="inline-warning" role="status">
                <AlertTriangle aria-hidden="true" />
                <span>
                  Refresh failed. The last loaded view remains available.
                </span>
                <Button variant="tertiary" onClick={() => void refresh()}>
                  Retry
                </Button>
              </div>
            ) : null}
            {area === "agenda" ? (
              <AgendaView
                data={data}
                cursor={cursor}
                onEditEvent={(item) => setEditor({ type: "event", item })}
                onDeleteEvent={requestDeleteEvent}
                onOccurrence={safelyChangeOccurrence}
                onAdd={() => setEditor({ type: "event" })}
              />
            ) : null}
            {area === "day" ? (
              <DayView
                data={data}
                date={cursor}
                now={now}
                onEditEvent={(item) => setEditor({ type: "event", item })}
                onDeleteEvent={requestDeleteEvent}
                onOccurrence={safelyChangeOccurrence}
                onAddAt={(startTime) => setEditor({ type: "event", startTime })}
              />
            ) : null}
            {area === "week" ? (
              <WeekView
                data={data}
                start={range.start}
                end={range.end}
                onSelectDay={(date) => navigateTo("day", date)}
                onEditEvent={(item) => setEditor({ type: "event", item })}
                onOccurrence={safelyChangeOccurrence}
              />
            ) : null}
            {area === "priorities" ? (
              <PrioritiesView
                priorities={data.priorities}
                timeZone={data.preferences.timeZone}
                now={now}
                onAdd={() => setEditor({ type: "priority" })}
                onEdit={(item) => setEditor({ type: "priority", item })}
                onChange={changePriority}
                onDelete={removePriority}
                onMove={moveTopPriority}
              />
            ) : null}
            {area === "routines" ? (
              <RoutinesView
                routines={data.routines}
                occurrences={data.occurrences}
                today={localDateInZone(now, data.preferences.timeZone)}
                hourCycle={data.preferences.hourCycle}
                onAdd={() => setEditor({ type: "routine" })}
                onEdit={(item) => setEditor({ type: "routine", item })}
                onState={changeRoutineState}
                onOccurrence={safelyChangeOccurrence}
                onNote={setNoteOccurrence}
              />
            ) : null}
          </>
        )}
      </div>

      <QuickAddDialog
        open={editor?.type === "quick"}
        onClose={() => setEditor(null)}
        onChoose={(type) => setEditor({ type })}
      />
      <EventEditor
        key={
          editor?.type === "event"
            ? `event-${editor.item?.occurrenceKey ?? editor.startTime ?? "new"}`
            : "event-closed"
        }
        open={editor?.type === "event"}
        item={editor?.type === "event" ? editor.item : undefined}
        defaultDate={cursor}
        defaultStartTime={
          editor?.type === "event" ? editor.startTime : undefined
        }
        timeZone={data?.preferences.timeZone ?? detectedTimeZone()}
        onClose={() => setEditor(null)}
        onSave={requestSaveEvent}
      />
      <PriorityEditor
        key={
          editor?.type === "priority"
            ? `priority-${editor.item?.id ?? "new"}`
            : "priority-closed"
        }
        open={editor?.type === "priority"}
        item={editor?.type === "priority" ? editor.item : undefined}
        timeZone={data?.preferences.timeZone ?? detectedTimeZone()}
        onClose={() => setEditor(null)}
        onSave={savePriority}
      />
      <RoutineEditor
        key={
          editor?.type === "routine"
            ? `routine-${editor.item?.id ?? "new"}`
            : "routine-closed"
        }
        open={editor?.type === "routine"}
        item={editor?.type === "routine" ? editor.item : undefined}
        defaultDate={cursor}
        onClose={() => setEditor(null)}
        onSave={saveRoutine}
      />
      <PreferencesDialog
        open={editor?.type === "preferences"}
        preferences={data?.preferences}
        onClose={() => setEditor(null)}
        onSave={savePreferences}
      />
      <ScopeDialog
        action={scopeAction}
        onClose={() => setScopeAction(null)}
        onChoose={(scope) => void applyScope(scope)}
      />
      <ConflictDialog
        action={conflictAction}
        onClose={() => setConflictAction(null)}
        onProceed={() => {
          if (!conflictAction) return;
          void saveEvent(
            conflictAction.input,
            conflictAction.item,
            conflictAction.scope,
            true,
          ).catch((conflictError) =>
            notify(
              conflictError instanceof Error
                ? conflictError.message
                : "The event was not saved.",
            ),
          );
        }}
      />
      <OccurrenceNoteDialog
        key={noteOccurrence?.id ?? "occurrence-note-closed"}
        occurrence={noteOccurrence}
        onClose={() => setNoteOccurrence(null)}
        onSave={async (note) => {
          if (!noteOccurrence) return;
          await changeOccurrence(
            noteOccurrence,
            noteOccurrence.status === "missed" ? "due" : noteOccurrence.status,
            note,
          );
          setNoteOccurrence(null);
        }}
      />
      <ToastRegion toast={toast} onDismiss={() => setToast(null)} />
    </AppShell>
  );
}

function TimeHeader({
  area,
  cursor,
  range,
  refreshing,
  sourceLabel,
  onArea,
  onPrevious,
  onNext,
  onToday,
  onRefresh,
  onAdd,
  onPreferences,
}: {
  area: TimeArea;
  cursor: string;
  range: { start: string; end: string };
  refreshing: boolean;
  sourceLabel?: string;
  onArea(area: TimeArea): void;
  onPrevious(): void;
  onNext(): void;
  onToday(): void;
  onRefresh(): void;
  onAdd(): void;
  onPreferences(): void;
}) {
  const title =
    area === "week"
      ? `${formatDate(range.start, {
          month: "short",
          day: "numeric",
        })} – ${formatDate(range.end, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`
      : formatDate(cursor);
  return (
    <header className="time-header">
      <div className="time-header__title">
        <p className="eyebrow">Personal time</p>
        <h1>{title}</h1>
        <p>
          {sourceLabel ?? "Private local workspace"} · External sync not
          connected
        </p>
      </div>
      <div className="time-header__actions">
        <Button
          variant="icon"
          aria-label="Time and reminder settings"
          icon={<Settings2 aria-hidden="true" />}
          onClick={onPreferences}
        />
        <Button
          variant="tertiary"
          loading={refreshing}
          icon={<RefreshCw aria-hidden="true" />}
          onClick={onRefresh}
        >
          Refresh
        </Button>
        <Button
          variant="primary"
          icon={<Plus aria-hidden="true" />}
          onClick={onAdd}
        >
          Add
        </Button>
      </div>
      <div className="time-toolbar">
        <div className="view-switcher" role="group" aria-label="Time views">
          {(
            [
              ["agenda", "Agenda", List],
              ["day", "Day", Clock3],
              ["week", "Week", CalendarDays],
              ["priorities", "Priorities", CheckCircle2],
              ["routines", "Routines", Repeat2],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              className={area === value ? "is-active" : ""}
              aria-pressed={area === value}
              onClick={() => onArea(value)}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="date-navigation" role="group" aria-label="Change date">
          <Button
            variant="icon"
            aria-label="Previous period"
            icon={<ChevronLeft aria-hidden="true" />}
            onClick={onPrevious}
          />
          <Button variant="tertiary" onClick={onToday}>
            Today
          </Button>
          <Button
            variant="icon"
            aria-label="Next period"
            icon={<ChevronRight aria-hidden="true" />}
            onClick={onNext}
          />
        </div>
      </div>
    </header>
  );
}

function TimeFilters({
  filters,
  onChange,
}: {
  filters: CalendarFilters;
  onChange(filters: CalendarFilters): void;
}) {
  return (
    <div className="time-filters">
      <label className="search-field">
        <span className="sr-only">Search personal time</span>
        <Search aria-hidden="true" />
        <input
          type="search"
          value={filters.query}
          onChange={(event) =>
            onChange({ ...filters, query: event.target.value })
          }
          placeholder="Search events, priorities, and routines"
        />
      </label>
      <details className="filter-menu">
        <summary>
          <Filter aria-hidden="true" />
          Filters
        </summary>
        <div className="filter-menu__surface">
          {(
            [
              ["includeEvents", "Events"],
              ["includePriorities", "Priorities"],
              ["includeRoutines", "Routines"],
              ["includeCompleted", "Completed and canceled"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={filters[key]}
                onChange={(event) =>
                  onChange({ ...filters, [key]: event.target.checked })
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

function ReminderNotice({ data, now }: { data: CalendarPayload; now: Date }) {
  const due = data.reminders
    .filter((reminder) => reminder.enabled)
    .map((reminder) => {
      if (reminder.entityType === "event") {
        const event = data.events.find(
          (item) => item.id === reminder.entityId && item.startAt,
        );
        return {
          label: event?.title ?? "",
          trigger: event?.startAt
            ? new Date(
                Date.parse(event.startAt) - reminder.offsetMinutes * 60_000,
              )
            : null,
        };
      }
      if (reminder.entityType === "priority") {
        const priority = data.priorities.find(
          (item) => item.id === reminder.entityId,
        );
        return {
          label: priority?.title ?? "",
          trigger: priority?.dueAt
            ? new Date(
                Date.parse(priority.dueAt) - reminder.offsetMinutes * 60_000,
              )
            : null,
        };
      }
      const routine = data.routines.find(
        (item) => item.id === reminder.entityId,
      );
      const occurrence = data.occurrences.find(
        (item) =>
          item.routineId === reminder.entityId &&
          item.scheduledAt &&
          !["completed", "skipped"].includes(item.status),
      );
      return {
        label: routine?.name ?? "",
        trigger: occurrence?.scheduledAt
          ? new Date(
              Date.parse(occurrence.scheduledAt) -
                reminder.offsetMinutes * 60_000,
            )
          : null,
      };
    })
    .filter(
      (entry) =>
        entry.trigger &&
        now.getTime() >= entry.trigger.getTime() &&
        now.getTime() - entry.trigger.getTime() < 60 * 60_000,
    );
  if (!due.length && data.preferences.notificationPermission !== "denied")
    return null;
  const quiet = isInQuietHours(
    localTimeInZone(now, data.preferences.timeZone),
    data.preferences,
  );
  return (
    <div className="reminder-notice" role="status">
      <Bell aria-hidden="true" />
      <div>
        <strong>
          {data.preferences.notificationPermission === "denied"
            ? "Device notifications are unavailable"
            : quiet && data.preferences.quietBehavior !== "allow"
              ? "A reminder falls within quiet hours"
              : `${due.length} in-app reminder${due.length === 1 ? "" : "s"} due`}
        </strong>
        <p>
          {data.preferences.notificationPermission === "denied"
            ? "Nexus will continue to show in-app reminders without claiming a system notification was delivered."
            : quiet
              ? `Quiet hours are active. The configured behavior is ${data.preferences.quietBehavior}.`
              : due.map((entry) => entry.label).join(", ")}
        </p>
      </div>
    </div>
  );
}

function AgendaView({
  data,
  cursor,
  onEditEvent,
  onDeleteEvent,
  onOccurrence,
  onAdd,
}: {
  data: CalendarPayload;
  cursor: string;
  onEditEvent(event: CalendarEvent): void;
  onDeleteEvent(event: CalendarEvent): void;
  onOccurrence(
    occurrence: RoutineOccurrence,
    status: "due" | "completed" | "skipped",
  ): void;
  onAdd(): void;
}) {
  const dates = dateRange(data.rangeStart, data.rangeEnd);
  const hourCycle = data.preferences.hourCycle;
  const hasAnything =
    data.events.length ||
    data.occurrences.length ||
    data.priorities.some((priority) => {
      if (!priority.dueAt) return false;
      const date = localDateInZone(priority.dueAt, data.preferences.timeZone);
      return date >= data.rangeStart && date <= data.rangeEnd;
    });
  if (!hasAnything) {
    return (
      <Panel>
        <EmptyState
          title="Your agenda is open"
          detail="Add one event or routine to give this period structure. Nothing has been assumed."
          headingLevel={2}
          action={
            <Button
              variant="primary"
              icon={<Plus aria-hidden="true" />}
              onClick={onAdd}
            >
              Add event
            </Button>
          }
        />
      </Panel>
    );
  }
  return (
    <div className="agenda-view">
      {dates.map((date) => {
        const events = data.events.filter((event) =>
          eventOverlapsDate(event, date),
        );
        const occurrences = data.occurrences.filter(
          (item) => item.scheduledDate === date,
        );
        const priorities = data.priorities.filter(
          (priority) =>
            priority.dueAt &&
            localDateInZone(priority.dueAt, data.preferences.timeZone) === date,
        );
        const empty =
          !events.length && !occurrences.length && !priorities.length;
        return (
          <section
            key={date}
            className={`agenda-day ${date === cursor ? "is-selected" : ""}`}
            aria-labelledby={`agenda-${date}`}
          >
            <header>
              <div>
                <p className="eyebrow">
                  {date ===
                  localDateInZone(new Date(), data.preferences.timeZone)
                    ? "Today"
                    : "Personal schedule"}
                </p>
                <h2 id={`agenda-${date}`}>{formatDate(date)}</h2>
              </div>
              <span>
                {empty
                  ? "Open"
                  : `${events.length + occurrences.length + priorities.length} items`}
              </span>
            </header>
            {empty ? (
              <p className="agenda-day__empty">
                No commitments. Keep the space open or add something
                intentional.
              </p>
            ) : (
              <ol className="agenda-items">
                {events.map((event) => (
                  <li key={event.occurrenceKey}>
                    <EventCard
                      event={event}
                      hourCycle={hourCycle}
                      onEdit={() => onEditEvent(event)}
                      onDelete={() => onDeleteEvent(event)}
                    />
                  </li>
                ))}
                {occurrences.map((occurrence) => (
                  <li key={`${occurrence.routineId}-${date}`}>
                    <OccurrenceCard
                      occurrence={occurrence}
                      hourCycle={hourCycle}
                      onChange={(status) => onOccurrence(occurrence, status)}
                    />
                  </li>
                ))}
                {priorities.map((priority) => (
                  <li key={priority.id}>
                    <div className="agenda-priority">
                      <CheckCircle2 aria-hidden="true" />
                      <div>
                        <strong>{priority.title}</strong>
                        <span>
                          Priority due · {formatTime(priority.dueAt, hourCycle)}
                        </span>
                      </div>
                      {priority.isTop ? (
                        <Badge tone="gold">Top three</Badge>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}

function EventCard({
  event,
  hourCycle,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent;
  hourCycle: "12" | "24";
  onEdit(): void;
  onDelete(): void;
}) {
  return (
    <article
      className={`calendar-event calendar-event--${event.status} ${
        event.conflictState !== "none" ? "calendar-event--conflict" : ""
      }`}
    >
      <span className="calendar-event__marker" aria-hidden="true" />
      <div>
        <div className="calendar-event__title">
          <strong>{event.title}</strong>
          {event.recurrence ? (
            <span title={recurrenceLabel(event.recurrence)}>
              <Repeat2 aria-hidden="true" /> Recurring
            </span>
          ) : null}
          {event.status !== "confirmed" ? (
            <Badge tone={event.status === "canceled" ? "danger" : "neutral"}>
              {event.status}
            </Badge>
          ) : null}
        </div>
        <p>{eventTime(event, hourCycle)}</p>
        {event.location ? <p>{event.location}</p> : null}
        {event.conflictState !== "none" ? (
          <p className="surface-note">
            Sync conflict: this record has a newer{" "}
            {event.conflictState === "local-newer" ? "local" : "remote"}{" "}
            version. No version was overwritten.
          </p>
        ) : null}
      </div>
      <div className="item-actions">
        <Button
          variant="icon"
          aria-label={`Edit ${event.title}`}
          icon={<Pencil aria-hidden="true" />}
          onClick={onEdit}
        />
        <Button
          variant="icon"
          aria-label={`Remove ${event.title}`}
          icon={<Trash2 aria-hidden="true" />}
          onClick={onDelete}
        />
      </div>
    </article>
  );
}

function OccurrenceCard({
  occurrence,
  hourCycle,
  onChange,
  onNote,
}: {
  occurrence: RoutineOccurrence;
  hourCycle: "12" | "24";
  onChange(status: "due" | "completed" | "skipped"): void;
  onNote?(): void;
}) {
  return (
    <article
      className={`routine-occurrence routine-occurrence--${occurrence.status}`}
    >
      <span className="routine-occurrence__check" aria-hidden="true">
        {occurrence.status === "completed" ? <Check /> : <Repeat2 />}
      </span>
      <div>
        <strong>{occurrence.routineName}</strong>
        <p>
          Routine · {formatTime(occurrence.scheduledAt, hourCycle)} ·{" "}
          {occurrence.status}
        </p>
        {occurrence.note ? <p>{occurrence.note}</p> : null}
      </div>
      <div className="item-actions">
        {onNote ? (
          <Button
            variant="icon"
            aria-label={`Add note to ${occurrence.routineName}`}
            icon={<Pencil aria-hidden="true" />}
            onClick={onNote}
          />
        ) : null}
        {occurrence.status === "completed" ||
        occurrence.status === "skipped" ? (
          <Button
            variant="icon"
            aria-label={`Restore ${occurrence.routineName}`}
            icon={<RotateCcw aria-hidden="true" />}
            onClick={() => onChange("due")}
          />
        ) : (
          <>
            <Button
              variant="icon"
              aria-label={`Complete ${occurrence.routineName}`}
              icon={<Check aria-hidden="true" />}
              onClick={() => onChange("completed")}
            />
            <Button
              variant="icon"
              aria-label={`Skip ${occurrence.routineName}`}
              icon={<X aria-hidden="true" />}
              onClick={() => onChange("skipped")}
            />
          </>
        )}
      </div>
    </article>
  );
}

function DayView({
  data,
  date,
  now,
  onEditEvent,
  onDeleteEvent,
  onOccurrence,
  onAddAt,
}: {
  data: CalendarPayload;
  date: string;
  now: Date;
  onEditEvent(event: CalendarEvent): void;
  onDeleteEvent(event: CalendarEvent): void;
  onOccurrence(
    occurrence: RoutineOccurrence,
    status: "due" | "completed" | "skipped",
  ): void;
  onAddAt(time: string): void;
}) {
  const events = data.events.filter((event) => eventOverlapsDate(event, date));
  const allDay = events.filter((event) => event.allDay);
  const timed = events.filter((event) => !event.allDay);
  const occurrences = data.occurrences.filter(
    (occurrence) => occurrence.scheduledDate === date,
  );
  const priorities = data.priorities.filter(
    (priority) =>
      priority.status === "active" &&
      priority.dueAt &&
      localDateInZone(priority.dueAt, data.preferences.timeZone) === date,
  );
  const current =
    date === localDateInZone(now, data.preferences.timeZone)
      ? currentTimePosition(now, data.preferences.timeZone)
      : null;
  const hours = Array.from({ length: 17 }, (_, index) => index + 6);
  return (
    <div className="day-view">
      <Panel className="all-day-panel">
        <SectionHeader eyebrow="All day" title={formatDate(date)} />
        {allDay.length ? (
          <div className="all-day-list">
            {allDay.map((event) => (
              <EventCard
                key={event.occurrenceKey}
                event={event}
                hourCycle={data.preferences.hourCycle}
                onEdit={() => onEditEvent(event)}
                onDelete={() => onDeleteEvent(event)}
              />
            ))}
          </div>
        ) : (
          <p className="surface-note">No all-day commitments.</p>
        )}
      </Panel>
      <section
        className="time-grid"
        aria-label={`Schedule for ${formatDate(date)}`}
      >
        {current !== null ? (
          <div
            className="current-time-line"
            style={{ top: `${current}%` }}
            aria-label={`Current time ${formatTime(now.toISOString(), data.preferences.hourCycle)}`}
          >
            <span />
          </div>
        ) : null}
        {hours.map((hour) => {
          const time = `${String(hour).padStart(2, "0")}:00`;
          const items = timed.filter(
            (event) =>
              event.startAt &&
              Number(
                localTimeInZone(event.startAt, data.preferences.timeZone).slice(
                  0,
                  2,
                ),
              ) === hour,
          );
          const routines = occurrences.filter(
            (occurrence) =>
              occurrence.scheduledAt &&
              Number(
                localTimeInZone(
                  occurrence.scheduledAt,
                  data.preferences.timeZone,
                ).slice(0, 2),
              ) === hour,
          );
          const duePriorities = priorities.filter(
            (priority) =>
              priority.dueAt &&
              Number(
                localTimeInZone(
                  priority.dueAt,
                  data.preferences.timeZone,
                ).slice(0, 2),
              ) === hour,
          );
          const overlap = items.length + routines.length > 1;
          return (
            <div className="time-row" key={hour}>
              <button
                className="time-row__label"
                onClick={() => onAddAt(time)}
                aria-label={`Add event at ${time}`}
              >
                {new Intl.DateTimeFormat(undefined, {
                  hour: "numeric",
                  hourCycle:
                    data.preferences.hourCycle === "24" ? "h23" : "h12",
                  timeZone: "UTC",
                }).format(new Date(`2026-01-01T${time}:00Z`))}
              </button>
              <div
                className={`time-row__content ${overlap ? "has-overlap" : ""}`}
              >
                {overlap ? (
                  <span className="overlap-label">
                    <AlertTriangle aria-hidden="true" />
                    Overlap
                  </span>
                ) : null}
                {items.map((event) => (
                  <EventCard
                    key={event.occurrenceKey}
                    event={event}
                    hourCycle={data.preferences.hourCycle}
                    onEdit={() => onEditEvent(event)}
                    onDelete={() => onDeleteEvent(event)}
                  />
                ))}
                {routines.map((occurrence) => (
                  <OccurrenceCard
                    key={occurrence.id}
                    occurrence={occurrence}
                    hourCycle={data.preferences.hourCycle}
                    onChange={(status) => onOccurrence(occurrence, status)}
                  />
                ))}
                {duePriorities.map((priority) => (
                  <article className="agenda-priority" key={priority.id}>
                    <CheckCircle2 aria-hidden="true" />
                    <div>
                      <strong>{priority.title}</strong>
                      <span>
                        Priority due ·{" "}
                        {formatTime(priority.dueAt, data.preferences.hourCycle)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
        {!timed.length && !occurrences.length && !priorities.length ? (
          <p className="time-grid__empty">
            Your timed schedule is open. Select a time to add an event.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function WeekView({
  data,
  start,
  end,
  onSelectDay,
  onEditEvent,
  onOccurrence,
}: {
  data: CalendarPayload;
  start: string;
  end: string;
  onSelectDay(date: string): void;
  onEditEvent(event: CalendarEvent): void;
  onOccurrence(
    occurrence: RoutineOccurrence,
    status: "due" | "completed" | "skipped",
  ): void;
}) {
  return (
    <div className="week-view" role="list" aria-label="Week schedule">
      {dateRange(start, end).map((date) => {
        const events = data.events.filter((event) =>
          eventOverlapsDate(event, date),
        );
        const occurrences = data.occurrences.filter(
          (occurrence) => occurrence.scheduledDate === date,
        );
        return (
          <section
            key={date}
            className={`week-day ${date === todayKey() ? "is-today" : ""}`}
            role="listitem"
          >
            <button
              className="week-day__header"
              onClick={() => onSelectDay(date)}
              aria-label={`Open ${formatDate(date)}`}
            >
              <span>{formatDate(date, { weekday: "short" })}</span>
              <strong>{Number(date.slice(8, 10))}</strong>
            </button>
            <div className="week-day__items">
              {events.map((event) => (
                <button
                  key={event.occurrenceKey}
                  className={`week-event ${event.allDay ? "is-all-day" : ""}`}
                  onClick={() => onEditEvent(event)}
                >
                  <span>
                    {event.allDay
                      ? "All day"
                      : formatTime(event.startAt, data.preferences.hourCycle)}
                  </span>
                  <strong>{event.title}</strong>
                  {event.recurrence ? (
                    <span>
                      <Repeat2 aria-hidden="true" /> Recurring
                    </span>
                  ) : null}
                </button>
              ))}
              {occurrences.map((occurrence) => (
                <div className="week-routine" key={occurrence.id}>
                  <Repeat2 aria-hidden="true" />
                  <span>{occurrence.routineName}</span>
                  {occurrence.status === "completed" ? (
                    <Check aria-label="Completed" />
                  ) : (
                    <button
                      aria-label={`Complete ${occurrence.routineName}`}
                      onClick={() => onOccurrence(occurrence, "completed")}
                    >
                      <Circle aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
              {!events.length && !occurrences.length ? (
                <span className="week-day__empty">Open</span>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PrioritiesView({
  priorities,
  timeZone,
  now,
  onAdd,
  onEdit,
  onChange,
  onDelete,
  onMove,
}: {
  priorities: Priority[];
  timeZone: string;
  now: Date;
  onAdd(): void;
  onEdit(item: Priority): void;
  onChange(item: Priority, update: PriorityUpdate): void;
  onDelete(item: Priority): void;
  onMove(item: Priority, direction: -1 | 1): void;
}) {
  const today = localDateInZone(now, timeZone);
  const active = priorities.filter((item) => item.status === "active");
  const top = active
    .filter((item) => item.isTop !== false)
    .sort((a, b) => a.position - b.position);
  const other = active.filter((item) => item.isTop === false);
  const completed = priorities.filter((item) => item.status === "completed");
  const rollover = async (item: Priority) => {
    const time = item.dueAt ? localTimeInZone(item.dueAt, timeZone) : "17:00";
    onChange(item, {
      dueAt: zonedDateTimeToUtc(today, time, timeZone),
    });
  };
  return (
    <div className="priority-workspace">
      <Panel tone="emphasis">
        <SectionHeader
          eyebrow="Top three"
          title="What matters most"
          action={
            <Button
              variant="primary"
              icon={<Plus aria-hidden="true" />}
              onClick={onAdd}
            >
              Add priority
            </Button>
          }
        />
        {top.length ? (
          <ol className="priority-workspace__list">
            {top.map((item, index) => (
              <li key={item.id}>
                <span className="priority-rank">{index + 1}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>
                    {item.dueAt
                      ? `Due ${formatDate(
                          localDateInZone(item.dueAt, timeZone),
                          { month: "short", day: "numeric" },
                        )} at ${formatTime(item.dueAt)}`
                      : "No due date"}
                  </p>
                  {item.scheduledStartAt ? (
                    <p>
                      Focus{" "}
                      {formatDate(
                        localDateInZone(item.scheduledStartAt, timeZone),
                        { month: "short", day: "numeric" },
                      )}{" "}
                      · {formatTime(item.scheduledStartAt)}–
                      {formatTime(item.scheduledEndAt ?? null)}
                    </p>
                  ) : null}
                  {item.notes ? <p>{item.notes}</p> : null}
                  {item.dueAt &&
                  localDateInZone(item.dueAt, timeZone) < today ? (
                    <Button
                      variant="tertiary"
                      onClick={() => void rollover(item)}
                    >
                      Reschedule for today
                    </Button>
                  ) : null}
                </div>
                <div className="item-actions">
                  <Button
                    variant="icon"
                    aria-label={`Move ${item.title} up`}
                    disabled={index === 0}
                    icon={<ArrowUp aria-hidden="true" />}
                    onClick={() => onMove(item, -1)}
                  />
                  <Button
                    variant="icon"
                    aria-label={`Move ${item.title} down`}
                    disabled={index === top.length - 1}
                    icon={<ArrowDown aria-hidden="true" />}
                    onClick={() => onMove(item, 1)}
                  />
                  <Button
                    variant="icon"
                    aria-label={`Complete ${item.title}`}
                    icon={<Check aria-hidden="true" />}
                    onClick={() => onChange(item, { status: "completed" })}
                  />
                  <Button
                    variant="icon"
                    aria-label={`Edit ${item.title}`}
                    icon={<Pencil aria-hidden="true" />}
                    onClick={() => onEdit(item)}
                  />
                  <Button
                    variant="icon"
                    aria-label={`Demote ${item.title} from top three`}
                    icon={<ArrowDown aria-hidden="true" />}
                    onClick={() => onChange(item, { isTop: false })}
                  />
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState
            title="Set the direction"
            detail="Choose up to three outcomes that deserve your clearest attention."
            action={<Button onClick={onAdd}>Add priority</Button>}
          />
        )}
      </Panel>
      <div className="priority-workspace__columns">
        <Panel>
          <SectionHeader eyebrow="Upcoming" title="Personal priorities" />
          {other.length ? (
            <ul className="plain-list">
              {other.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>
                      {item.dueAt
                        ? formatDate(localDateInZone(item.dueAt, timeZone))
                        : "No due date"}
                      {item.scheduledStartAt
                        ? ` · Focus ${formatTime(item.scheduledStartAt)}`
                        : ""}
                    </span>
                  </div>
                  <div className="item-actions">
                    <Button
                      variant="tertiary"
                      disabled={top.length >= 3}
                      onClick={() => onChange(item, { isTop: true })}
                    >
                      Move to top three
                    </Button>
                    <Button
                      variant="icon"
                      aria-label={`Edit ${item.title}`}
                      icon={<Pencil aria-hidden="true" />}
                      onClick={() => onEdit(item)}
                    />
                    <Button
                      variant="icon"
                      aria-label={`Delete ${item.title}`}
                      icon={<Trash2 aria-hidden="true" />}
                      onClick={() => onDelete(item)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="surface-note">
              No additional priorities are waiting.
            </p>
          )}
        </Panel>
        <Panel tone="quiet">
          <SectionHeader eyebrow="History" title="Completed" />
          {completed.length ? (
            <ul className="plain-list">
              {completed.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>
                      Completed{" "}
                      {item.completedAt
                        ? formatDate(
                            localDateInZone(item.completedAt, timeZone),
                          )
                        : "without a recorded time"}
                    </span>
                  </div>
                  <Button
                    variant="tertiary"
                    icon={<RotateCcw aria-hidden="true" />}
                    onClick={() => onChange(item, { status: "active" })}
                  >
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="surface-note">No completed priorities yet.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function RoutinesView({
  routines,
  occurrences,
  today,
  hourCycle,
  onAdd,
  onEdit,
  onState,
  onOccurrence,
  onNote,
}: {
  routines: Routine[];
  occurrences: RoutineOccurrence[];
  today: string;
  hourCycle: "12" | "24";
  onAdd(): void;
  onEdit(item: Routine): void;
  onState(item: Routine, state: Routine["state"]): void;
  onOccurrence(
    occurrence: RoutineOccurrence,
    status: "due" | "completed" | "skipped",
  ): void;
  onNote(occurrence: RoutineOccurrence): void;
}) {
  const todayOccurrences = occurrences.filter(
    (item) => item.scheduledDate === today,
  );
  const history = occurrences
    .filter(
      (item) =>
        item.scheduledDate < today &&
        ["completed", "skipped", "missed"].includes(item.status),
    )
    .slice(-30)
    .reverse();
  return (
    <div className="routines-workspace">
      <Panel tone="emphasis">
        <SectionHeader
          eyebrow="Today"
          title="Routine occurrences"
          action={
            <Button
              variant="primary"
              icon={<Plus aria-hidden="true" />}
              onClick={onAdd}
            >
              Add routine
            </Button>
          }
        />
        {todayOccurrences.length ? (
          <div className="routine-today-list">
            {todayOccurrences.map((occurrence) => (
              <OccurrenceCard
                key={occurrence.id}
                occurrence={occurrence}
                hourCycle={hourCycle}
                onChange={(status) => onOccurrence(occurrence, status)}
                onNote={() => onNote(occurrence)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No routines are due today"
            detail="The day is open. Add a repeatable personal behavior only when it deserves a place."
            action={<Button onClick={onAdd}>Create routine</Button>}
          />
        )}
      </Panel>
      <div className="routines-workspace__columns">
        <Panel>
          <SectionHeader eyebrow="Definitions" title="Active routines" />
          <ul className="routine-definition-list">
            {routines
              .filter((routine) => routine.state !== "archived")
              .map((routine) => (
                <li key={routine.id}>
                  <div>
                    <strong>{routine.name}</strong>
                    <span>
                      {recurrenceLabel(routine.schedule)}
                      {routine.preferredTime
                        ? ` · ${routine.preferredTime}`
                        : " · Flexible"}
                    </span>
                    {routine.description ? <p>{routine.description}</p> : null}
                  </div>
                  <Badge
                    tone={routine.state === "active" ? "success" : "neutral"}
                  >
                    {routine.state}
                  </Badge>
                  <div className="item-actions">
                    <Button
                      variant="icon"
                      aria-label={`Edit ${routine.name}`}
                      icon={<Pencil aria-hidden="true" />}
                      onClick={() => onEdit(routine)}
                    />
                    <Button
                      variant="icon"
                      aria-label={
                        routine.state === "active"
                          ? `Pause ${routine.name}`
                          : `Resume ${routine.name}`
                      }
                      icon={
                        routine.state === "active" ? (
                          <Pause aria-hidden="true" />
                        ) : (
                          <RotateCcw aria-hidden="true" />
                        )
                      }
                      onClick={() =>
                        onState(
                          routine,
                          routine.state === "active" ? "paused" : "active",
                        )
                      }
                    />
                    <Button
                      variant="icon"
                      aria-label={`Archive ${routine.name}`}
                      icon={<Archive aria-hidden="true" />}
                      onClick={() => onState(routine, "archived")}
                    />
                  </div>
                </li>
              ))}
          </ul>
          {!routines.some((routine) => routine.state !== "archived") ? (
            <p className="surface-note">No active or paused routines.</p>
          ) : null}
        </Panel>
        <Panel tone="quiet">
          <SectionHeader eyebrow="History" title="Recent occurrences" />
          {history.length ? (
            <ul className="history-list">
              {history.map((occurrence) => (
                <li key={`${occurrence.routineId}-${occurrence.scheduledDate}`}>
                  <span>
                    {occurrence.status === "completed" ? (
                      <Check aria-hidden="true" />
                    ) : occurrence.status === "skipped" ? (
                      <ArrowRight aria-hidden="true" />
                    ) : (
                      <Clock3 aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <strong>{occurrence.routineName}</strong>
                    <p>
                      {formatDate(occurrence.scheduledDate)} ·{" "}
                      {occurrence.status}
                    </p>
                    {occurrence.note ? <p>{occurrence.note}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="surface-note">
              Completion, skip, and missed history will appear here.
            </p>
          )}
          {routines.some((routine) => routine.state === "archived") ? (
            <details className="archive-details">
              <summary>Archived routines</summary>
              <ul>
                {routines
                  .filter((routine) => routine.state === "archived")
                  .map((routine) => (
                    <li key={routine.id}>{routine.name}</li>
                  ))}
              </ul>
            </details>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}

function QuickAddDialog({
  open,
  onClose,
  onChoose,
}: {
  open: boolean;
  onClose(): void;
  onChoose(type: "event" | "priority" | "routine"): void;
}) {
  return (
    <Dialog
      open={open}
      title="Add to personal time"
      description="Choose the record you want to create. Nothing is sent outside Nexus."
      onClose={onClose}
    >
      <div className="quick-add-grid">
        <button onClick={() => onChoose("event")}>
          <CalendarClock aria-hidden="true" />
          <strong>Event</strong>
          <span>Schedule time or an all-day commitment.</span>
        </button>
        <button onClick={() => onChoose("priority")}>
          <CheckCircle2 aria-hidden="true" />
          <strong>Priority</strong>
          <span>Record an outcome and optional due time.</span>
        </button>
        <button onClick={() => onChoose("routine")}>
          <Repeat2 aria-hidden="true" />
          <strong>Routine</strong>
          <span>Create a repeatable personal behavior.</span>
        </button>
      </div>
    </Dialog>
  );
}

function EventEditor({
  open,
  item,
  defaultDate,
  defaultStartTime,
  timeZone,
  onClose,
  onSave,
}: {
  open: boolean;
  item?: CalendarEvent;
  defaultDate: string;
  defaultStartTime?: string;
  timeZone: string;
  onClose(): void;
  onSave(input: CalendarEventInput, item?: CalendarEvent): void | Promise<void>;
}) {
  const startTime = defaultStartTime ?? "09:00";
  const startHour = Number(startTime.slice(0, 2));
  const endTime = `${String(Math.min(startHour + 1, 23)).padStart(2, "0")}:${startTime.slice(3)}`;
  const [title, setTitle] = useState(item?.title ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [location, setLocation] = useState(item?.location ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [status, setStatus] = useState(item?.status ?? "confirmed");
  const [allDay, setAllDay] = useState(item?.allDay ?? false);
  const [localDate, setLocalDate] = useState(item?.localDate ?? defaultDate);
  const [endLocalDate, setEndLocalDate] = useState(
    item?.endLocalDate ?? defaultDate,
  );
  const [localStartTime, setLocalStartTime] = useState(
    item?.startTime ?? startTime,
  );
  const [localEndTime, setLocalEndTime] = useState(item?.endTime ?? endTime);
  const [zone, setZone] = useState(item?.timeZone ?? timeZone);
  const [frequency, setFrequency] = useState<
    "none" | RecurrenceRule["frequency"]
  >(item?.recurrence?.frequency ?? "none");
  const [interval, setInterval] = useState(item?.recurrence?.interval ?? 1);
  const [weekdays, setWeekdays] = useState<number[]>(
    item?.recurrence?.weekdays ?? [],
  );
  const [monthlyMode, setMonthlyMode] = useState<"date" | "relative">(
    item?.recurrence?.monthlyMode ?? "date",
  );
  const [until, setUntil] = useState(item?.recurrence?.until ?? "");
  const [count, setCount] = useState(
    item?.recurrence?.count ? String(item.recurrence.count) : "",
  );
  const [reminder, setReminder] = useState(
    String(item?.reminderOffsets[0] ?? ""),
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (!title.trim()) {
      setFormError("Enter an event title.");
      return;
    }
    const recurrence: RecurrenceRule | null =
      frequency === "none"
        ? null
        : {
            frequency,
            interval,
            weekdays:
              frequency === "weekly" && weekdays.length
                ? weekdays
                : frequency === "weekly"
                  ? [new Date(`${localDate}T12:00:00Z`).getUTCDay()]
                  : [],
            monthlyMode,
            until: until || null,
            count: count === "" ? null : Number(count),
          };
    const input: CalendarEventInput = {
      title: title.trim(),
      notes: notes.trim(),
      location: location.trim(),
      category: category.trim() || null,
      status,
      allDay,
      localDate,
      endLocalDate,
      startTime: allDay ? null : localStartTime,
      endTime: allDay ? null : localEndTime,
      timeZone: zone,
      recurrence,
      reminderOffsets: reminder === "" ? [] : [Number(reminder)],
    };
    try {
      setSaving(true);
      await onSave(input, item);
    } catch (saveError) {
      setFormError(
        saveError instanceof Error
          ? saveError.message
          : "The event was not saved. Your entries remain here.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      title={item ? "Edit event" : "Add event"}
      description={
        item?.seriesId
          ? "After saving, choose whether the change applies to this event, future events, or the entire series."
          : "Times use the selected event time zone. All-day dates stay fixed."
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="tertiary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="event-form"
            variant="primary"
            loading={saving}
          >
            {item ? "Review changes" : "Add event"}
          </Button>
        </>
      }
    >
      <form id="event-form" className="form" onSubmit={submit}>
        <label>
          <span>Title</span>
          <input
            autoFocus
            value={title}
            maxLength={160}
            onChange={(event) => setTitle(event.target.value)}
            aria-describedby={formError ? "event-form-error" : undefined}
          />
        </label>
        <div className="form-row">
          <label>
            <span>Start date</span>
            <input
              type="date"
              value={localDate}
              onChange={(event) => {
                setLocalDate(event.target.value);
                if (endLocalDate < event.target.value)
                  setEndLocalDate(event.target.value);
              }}
            />
          </label>
          <label>
            <span>End date</span>
            <input
              type="date"
              min={localDate}
              value={endLocalDate}
              onChange={(event) => setEndLocalDate(event.target.value)}
            />
          </label>
        </div>
        <label className="check-field">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(event) => setAllDay(event.target.checked)}
          />
          <span>All-day event</span>
        </label>
        {!allDay ? (
          <div className="form-row">
            <label>
              <span>Start time</span>
              <input
                type="time"
                value={localStartTime}
                onChange={(event) => setLocalStartTime(event.target.value)}
              />
            </label>
            <label>
              <span>End time</span>
              <input
                type="time"
                value={localEndTime}
                onChange={(event) => setLocalEndTime(event.target.value)}
              />
            </label>
          </div>
        ) : null}
        <label>
          <span>Time zone</span>
          <input
            value={zone}
            onChange={(event) => setZone(event.target.value)}
          />
        </label>
        <div className="form-row">
          <label>
            <span>Location (optional)</span>
            <input
              value={location}
              maxLength={240}
              onChange={(event) => setLocation(event.target.value)}
            />
          </label>
          <label>
            <span>Personal category (optional)</span>
            <input
              value={category ?? ""}
              maxLength={40}
              onChange={(event) => setCategory(event.target.value)}
            />
          </label>
        </div>
        <label>
          <span>Notes (optional)</span>
          <textarea
            value={notes}
            maxLength={4000}
            rows={3}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <div className="form-row">
          <label>
            <span>Repeat</span>
            <select
              value={frequency}
              onChange={(event) =>
                setFrequency(
                  event.target.value as "none" | RecurrenceRule["frequency"],
                )
              }
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          {frequency !== "none" ? (
            <label>
              <span>Every</span>
              <input
                type="number"
                min={1}
                max={365}
                value={interval}
                onChange={(event) => setInterval(Number(event.target.value))}
              />
            </label>
          ) : null}
        </div>
        {frequency === "weekly" ? (
          <fieldset>
            <legend>Selected weekdays</legend>
            <div className="weekday-picker">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                (label, index) => (
                  <label key={label}>
                    <input
                      type="checkbox"
                      checked={weekdays.includes(index)}
                      onChange={(event) =>
                        setWeekdays((current) =>
                          event.target.checked
                            ? [...current, index]
                            : current.filter((day) => day !== index),
                        )
                      }
                    />
                    <span>{label}</span>
                  </label>
                ),
              )}
            </div>
          </fieldset>
        ) : null}
        {frequency === "monthly" ? (
          <fieldset>
            <legend>Monthly pattern</legend>
            <div className="segmented-options">
              <label>
                <input
                  type="radio"
                  name="monthly-mode"
                  value="date"
                  checked={monthlyMode === "date"}
                  onChange={() => setMonthlyMode("date")}
                />
                <span>Same date</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="monthly-mode"
                  value="relative"
                  checked={monthlyMode === "relative"}
                  onChange={() => setMonthlyMode("relative")}
                />
                <span>Same relative weekday</span>
              </label>
            </div>
          </fieldset>
        ) : null}
        {frequency !== "none" ? (
          <div className="form-row">
            <label>
              <span>Repeat until (optional)</span>
              <input
                type="date"
                min={localDate}
                value={until}
                disabled={count !== ""}
                onChange={(event) => setUntil(event.target.value)}
              />
            </label>
            <label>
              <span>Or stop after occurrences</span>
              <input
                type="number"
                min={1}
                max={1000}
                value={count}
                disabled={until !== ""}
                onChange={(event) => setCount(event.target.value)}
              />
            </label>
          </div>
        ) : null}
        <div className="form-row">
          <label>
            <span>In-app reminder</span>
            <select
              value={reminder}
              onChange={(event) => setReminder(event.target.value)}
            >
              <option value="">None</option>
              <option value="0">At event time</option>
              <option value="5">5 minutes before</option>
              <option value="15">15 minutes before</option>
              <option value="60">1 hour before</option>
              <option value="1440">1 day before</option>
            </select>
          </label>
          <label>
            <span>Status</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as CalendarEvent["status"])
              }
            >
              <option value="confirmed">Confirmed</option>
              <option value="tentative">Tentative</option>
              <option value="canceled">Canceled</option>
            </select>
          </label>
        </div>
        {formError ? (
          <p className="form-error" id="event-form-error" role="alert">
            {formError}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

function PriorityEditor({
  open,
  item,
  timeZone,
  onClose,
  onSave,
}: {
  open: boolean;
  item?: Priority;
  timeZone: string;
  onClose(): void;
  onSave(input: PriorityInput, item?: Priority): void | Promise<void>;
}) {
  const dueDate = item?.dueAt ? localDateInZone(item.dueAt, timeZone) : "";
  const dueTime = item?.dueAt ? localTimeInZone(item.dueAt, timeZone) : "17:00";
  const initialFocusDate = item?.scheduledStartAt
    ? localDateInZone(item.scheduledStartAt, timeZone)
    : "";
  const initialFocusStart = item?.scheduledStartAt
    ? localTimeInZone(item.scheduledStartAt, timeZone)
    : "09:00";
  const initialFocusEnd = item?.scheduledEndAt
    ? localTimeInZone(item.scheduledEndAt, timeZone)
    : "10:00";
  const [title, setTitle] = useState(item?.title ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [date, setDate] = useState(dueDate);
  const [time, setTime] = useState(dueTime);
  const [focusDate, setFocusDate] = useState(initialFocusDate);
  const [focusStart, setFocusStart] = useState(initialFocusStart);
  const [focusEnd, setFocusEnd] = useState(initialFocusEnd);
  const [isTop, setIsTop] = useState(item?.isTop ?? true);
  const [reminder, setReminder] = useState(
    String(item?.reminderOffsetMinutes ?? ""),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError("Enter a priority.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      await onSave(
        {
          title: title.trim(),
          notes: notes.trim(),
          dueAt: date ? zonedDateTimeToUtc(date, time, timeZone) : null,
          isTop,
          scheduledStartAt: focusDate
            ? zonedDateTimeToUtc(focusDate, focusStart, timeZone)
            : null,
          scheduledEndAt: focusDate
            ? zonedDateTimeToUtc(focusDate, focusEnd, timeZone)
            : null,
          reminderEnabled: reminder !== "",
          reminderOffsetMinutes: reminder === "" ? null : Number(reminder),
        },
        item,
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The priority was not saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open={open}
      title={item ? "Edit priority" : "Add priority"}
      description="Priorities are personal outcomes. At most three can hold a top-three position."
      onClose={onClose}
      footer={
        <>
          <Button variant="tertiary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="priority-time-form"
            loading={saving}
          >
            {item ? "Save changes" : "Add priority"}
          </Button>
        </>
      }
    >
      <form id="priority-time-form" className="form" onSubmit={submit}>
        <label>
          <span>Priority</span>
          <input
            autoFocus
            value={title}
            maxLength={160}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          <span>Note (optional)</span>
          <textarea
            rows={3}
            value={notes}
            maxLength={1200}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <div className="form-row">
          <label>
            <span>Due date (optional)</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label>
            <span>Due time</span>
            <input
              type="time"
              value={time}
              disabled={!date}
              onChange={(event) => setTime(event.target.value)}
            />
          </label>
        </div>
        <fieldset>
          <legend>Scheduled focus time (optional)</legend>
          <div className="form-row">
            <label>
              <span>Date</span>
              <input
                type="date"
                value={focusDate}
                onChange={(event) => setFocusDate(event.target.value)}
              />
            </label>
            <label>
              <span>Start</span>
              <input
                type="time"
                value={focusStart}
                disabled={!focusDate}
                onChange={(event) => setFocusStart(event.target.value)}
              />
            </label>
            <label>
              <span>End</span>
              <input
                type="time"
                value={focusEnd}
                disabled={!focusDate}
                onChange={(event) => setFocusEnd(event.target.value)}
              />
            </label>
          </div>
        </fieldset>
        <label className="check-field">
          <input
            type="checkbox"
            checked={isTop}
            onChange={(event) => setIsTop(event.target.checked)}
          />
          <span>Place in top three</span>
        </label>
        <label>
          <span>In-app due reminder</span>
          <select
            value={reminder}
            onChange={(event) => setReminder(event.target.value)}
          >
            <option value="">None</option>
            <option value="0">At due time</option>
            <option value="15">15 minutes before</option>
            <option value="60">1 hour before</option>
            <option value="1440">1 day before</option>
          </select>
        </label>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

function RoutineEditor({
  open,
  item,
  defaultDate,
  onClose,
  onSave,
}: {
  open: boolean;
  item?: Routine;
  defaultDate: string;
  onClose(): void;
  onSave(input: RoutineInput, item?: Routine): void | Promise<void>;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [frequency, setFrequency] = useState<RecurrenceRule["frequency"]>(
    item?.schedule.frequency ?? "daily",
  );
  const [interval, setInterval] = useState(item?.schedule.interval ?? 1);
  const [weekdays, setWeekdays] = useState<number[]>(
    item?.schedule.weekdays ?? [],
  );
  const [startDate, setStartDate] = useState(item?.startDate ?? defaultDate);
  const [endDate, setEndDate] = useState(item?.endDate ?? "");
  const [preferredTime, setPreferredTime] = useState(
    item?.preferredTime ?? "07:00",
  );
  const [flexible, setFlexible] = useState(item?.preferredTime === null);
  const [windowStart, setWindowStart] = useState(item?.windowStart ?? "");
  const [windowEnd, setWindowEnd] = useState(item?.windowEnd ?? "");
  const [expectedMinutes, setExpectedMinutes] = useState(
    String(item?.expectedMinutes ?? ""),
  );
  const [reminder, setReminder] = useState(
    String(item?.reminderOffsetMinutes ?? ""),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter a routine name.");
      return;
    }
    const schedule: RecurrenceRule = {
      frequency,
      interval,
      weekdays:
        frequency === "weekly" && weekdays.length
          ? weekdays
          : frequency === "weekly"
            ? [new Date(`${startDate}T12:00:00Z`).getUTCDay()]
            : [],
      monthlyMode: "date",
      until: endDate || null,
      count: null,
    };
    try {
      setSaving(true);
      setError("");
      await onSave(
        {
          name: name.trim(),
          description: description.trim(),
          schedule,
          preferredTime: flexible ? null : preferredTime,
          windowStart: windowStart || null,
          windowEnd: windowEnd || null,
          expectedMinutes:
            expectedMinutes === "" ? null : Number(expectedMinutes),
          startDate,
          endDate: endDate || null,
          state: item?.state ?? "active",
          reminderEnabled: reminder !== "",
          reminderOffsetMinutes: reminder === "" ? null : Number(reminder),
        },
        item,
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The routine was not saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open={open}
      title={item ? "Edit routine" : "Add routine"}
      description="Schedule changes apply now and forward. Completed and skipped history is never rewritten."
      onClose={onClose}
      footer={
        <>
          <Button variant="tertiary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="routine-form"
            loading={saving}
          >
            {item ? "Save future schedule" : "Add routine"}
          </Button>
        </>
      }
    >
      <form id="routine-form" className="form" onSubmit={submit}>
        <label>
          <span>Routine name</span>
          <input
            autoFocus
            value={name}
            maxLength={160}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          <span>Concise description (optional)</span>
          <textarea
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <div className="form-row">
          <label>
            <span>Frequency</span>
            <select
              value={frequency}
              onChange={(event) =>
                setFrequency(event.target.value as RecurrenceRule["frequency"])
              }
            >
              <option value="daily">Every day</option>
              <option value="weekly">Selected weekdays / weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          <label>
            <span>Interval</span>
            <input
              type="number"
              min={1}
              max={365}
              value={interval}
              onChange={(event) => setInterval(Number(event.target.value))}
            />
          </label>
        </div>
        {frequency === "weekly" ? (
          <fieldset>
            <legend>Days of week</legend>
            <div className="weekday-picker">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                (label, index) => (
                  <label key={label}>
                    <input
                      type="checkbox"
                      checked={weekdays.includes(index)}
                      onChange={(event) =>
                        setWeekdays((current) =>
                          event.target.checked
                            ? [...current, index]
                            : current.filter((day) => day !== index),
                        )
                      }
                    />
                    <span>{label}</span>
                  </label>
                ),
              )}
            </div>
          </fieldset>
        ) : null}
        <div className="form-row">
          <label>
            <span>Start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label>
            <span>End date (optional)</span>
            <input
              type="date"
              min={startDate}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
        </div>
        <label className="check-field">
          <input
            type="checkbox"
            checked={flexible}
            onChange={(event) => setFlexible(event.target.checked)}
          />
          <span>Flexible time</span>
        </label>
        {!flexible ? (
          <label>
            <span>Preferred time</span>
            <input
              type="time"
              value={preferredTime}
              onChange={(event) => setPreferredTime(event.target.value)}
            />
          </label>
        ) : null}
        <div className="form-row">
          <label>
            <span>Window start (optional)</span>
            <input
              type="time"
              value={windowStart}
              onChange={(event) => setWindowStart(event.target.value)}
            />
          </label>
          <label>
            <span>Window end (optional)</span>
            <input
              type="time"
              value={windowEnd}
              onChange={(event) => setWindowEnd(event.target.value)}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            <span>Expected minutes (optional)</span>
            <input
              type="number"
              min={1}
              max={1440}
              inputMode="numeric"
              value={expectedMinutes}
              onChange={(event) => setExpectedMinutes(event.target.value)}
            />
          </label>
          <label>
            <span>In-app reminder</span>
            <select
              value={reminder}
              onChange={(event) => setReminder(event.target.value)}
            >
              <option value="">None</option>
              <option value="0">At preferred time</option>
              <option value="5">5 minutes before</option>
              <option value="15">15 minutes before</option>
              <option value="60">1 hour before</option>
            </select>
          </label>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

function PreferencesDialog({
  open,
  preferences,
  onClose,
  onSave,
}: {
  open: boolean;
  preferences?: TimePreferences;
  onClose(): void;
  onSave(preferences: TimePreferences): void | Promise<void>;
}) {
  const [timeZone, setTimeZone] = useState(
    preferences?.timeZone ?? detectedTimeZone(),
  );
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(
    preferences?.weekStartsOn ?? 1,
  );
  const [hourCycle, setHourCycle] = useState<"12" | "24">(
    preferences?.hourCycle ?? "12",
  );
  const [quietEnabled, setQuietEnabled] = useState(
    preferences?.quietHoursEnabled ?? false,
  );
  const [quietStart, setQuietStart] = useState(
    preferences?.quietHoursStart ?? "22:00",
  );
  const [quietEnd, setQuietEnd] = useState(
    preferences?.quietHoursEnd ?? "07:00",
  );
  const [quietBehavior, setQuietBehavior] = useState<
    TimePreferences["quietBehavior"]
  >(preferences?.quietBehavior ?? "delay");
  const [permissionDenied, setPermissionDenied] = useState(
    preferences?.notificationPermission === "denied",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      await onSave({
        timeZone,
        locale: preferences?.locale ?? navigator.language ?? "en-US",
        weekStartsOn,
        hourCycle,
        quietHoursEnabled: quietEnabled,
        quietHoursStart: quietStart,
        quietHoursEnd: quietEnd,
        quietBehavior,
        notificationPermission: permissionDenied ? "denied" : "in-app-only",
        updatedAt: new Date().toISOString(),
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Preferences were not saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open={open}
      title="Time and reminders"
      description="Nexus currently supports in-app reminders only. No device or external notification is claimed."
      onClose={onClose}
      footer={
        <>
          <Button variant="tertiary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="time-preferences-form"
            loading={saving}
          >
            Save preferences
          </Button>
        </>
      }
    >
      <form id="time-preferences-form" className="form" onSubmit={submit}>
        <label>
          <span>Display time zone</span>
          <input
            value={timeZone}
            onChange={(event) => setTimeZone(event.target.value)}
          />
        </label>
        <div className="form-row">
          <label>
            <span>Week starts on</span>
            <select
              value={weekStartsOn}
              onChange={(event) =>
                setWeekStartsOn(Number(event.target.value) as 0 | 1)
              }
            >
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
            </select>
          </label>
          <label>
            <span>Time format</span>
            <select
              value={hourCycle}
              onChange={(event) =>
                setHourCycle(event.target.value as "12" | "24")
              }
            >
              <option value="12">12-hour</option>
              <option value="24">24-hour</option>
            </select>
          </label>
        </div>
        <label className="check-field">
          <input
            type="checkbox"
            checked={quietEnabled}
            onChange={(event) => setQuietEnabled(event.target.checked)}
          />
          <span>Enable quiet hours</span>
        </label>
        {quietEnabled ? (
          <>
            <div className="form-row">
              <label>
                <span>Quiet hours start</span>
                <input
                  type="time"
                  value={quietStart}
                  onChange={(event) => setQuietStart(event.target.value)}
                />
              </label>
              <label>
                <span>Quiet hours end</span>
                <input
                  type="time"
                  value={quietEnd}
                  onChange={(event) => setQuietEnd(event.target.value)}
                />
              </label>
            </div>
            <label>
              <span>Reminder behavior during quiet hours</span>
              <select
                value={quietBehavior}
                onChange={(event) =>
                  setQuietBehavior(
                    event.target.value as TimePreferences["quietBehavior"],
                  )
                }
              >
                <option value="delay">Delay until quiet hours end</option>
                <option value="suppress">Suppress</option>
                <option value="allow">Allow time-sensitive reminders</option>
              </select>
            </label>
          </>
        ) : null}
        <label className="check-field">
          <input
            type="checkbox"
            checked={permissionDenied}
            onChange={(event) => setPermissionDenied(event.target.checked)}
          />
          <span>Device notification permission is denied or unavailable</span>
        </label>
        <p className="surface-note">
          In-app reminders remain useful when device permission is unavailable.
          Nexus does not request broad permission or claim delivery.
        </p>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

function OccurrenceNoteDialog({
  occurrence,
  onClose,
  onSave,
}: {
  occurrence: RoutineOccurrence | null;
  onClose(): void;
  onSave(note: string): void | Promise<void>;
}) {
  const [note, setNote] = useState(occurrence?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  return (
    <Dialog
      open={Boolean(occurrence)}
      title="Routine note"
      description={
        occurrence
          ? `Keep a brief note with ${occurrence.routineName} on ${formatDate(occurrence.scheduledDate)}.`
          : undefined
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="tertiary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={saving}
            onClick={async () => {
              try {
                setSaving(true);
                setError("");
                await onSave(note.trim());
              } catch (saveError) {
                setError(
                  saveError instanceof Error
                    ? saveError.message
                    : "The routine note was not saved.",
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            Save note
          </Button>
        </>
      }
    >
      <label className="form">
        <span>Note (optional)</span>
        <textarea
          autoFocus
          rows={4}
          maxLength={600}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        {error ? (
          <span className="form-error" role="alert">
            {error}
          </span>
        ) : null}
      </label>
    </Dialog>
  );
}

function ScopeDialog({
  action,
  onClose,
  onChoose,
}: {
  action: ScopeAction;
  onClose(): void;
  onChoose(scope: RecurrenceEditScope): void;
}) {
  const isOneOffDelete =
    action?.kind === "delete" && action.item.seriesId === null;
  return (
    <Dialog
      open={Boolean(action)}
      title={
        isOneOffDelete
          ? "Remove event"
          : action?.kind === "delete"
            ? "Remove recurring event"
            : "Apply recurring change"
      }
      description={
        isOneOffDelete
          ? `“${action.item.title}” will be removed from active Calendar views.`
          : action
            ? `Choose exactly how ${action.kind === "delete" ? "removing" : "changing"} “${action.item.title}” should affect its series.`
            : undefined
      }
      onClose={onClose}
    >
      {isOneOffDelete ? (
        <div className="dialog-confirm-actions">
          <Button variant="tertiary" onClick={onClose}>
            Keep event
          </Button>
          <Button variant="destructive" onClick={() => onChoose("series")}>
            Remove event
          </Button>
        </div>
      ) : (
        <div className="scope-options">
          <button onClick={() => onChoose("occurrence")}>
            <strong>This event only</strong>
            <span>
              {action?.kind === "delete"
                ? "Cancel only this occurrence; the series continues."
                : "Create an exception for this date; the series stays unchanged."}
            </span>
          </button>
          <button onClick={() => onChoose("future")}>
            <strong>This and future events</strong>
            <span>
              {action?.kind === "delete"
                ? "End the series before this occurrence and preserve earlier history."
                : "End the existing series before this date and create a new future series."}
            </span>
          </button>
          <button
            className={action?.kind === "delete" ? "is-destructive" : ""}
            onClick={() => onChoose("series")}
          >
            <strong>All events in the series</strong>
            <span>
              {action?.kind === "delete"
                ? "Remove the complete series from active Calendar views."
                : "Change the series definition, including its future occurrences."}
            </span>
          </button>
        </div>
      )}
    </Dialog>
  );
}

function ConflictDialog({
  action,
  onClose,
  onProceed,
}: {
  action: ConflictAction;
  onClose(): void;
  onProceed(): void;
}) {
  return (
    <Dialog
      open={Boolean(action)}
      title="Review schedule overlap"
      description="Nexus allows legitimate double-booking after you acknowledge the conflict."
      onClose={onClose}
      footer={
        <>
          <Button variant="tertiary" onClick={onClose}>
            Keep editing
          </Button>
          <Button variant="primary" onClick={onProceed}>
            Save with overlap
          </Button>
        </>
      }
    >
      <div className="conflict-list">
        <AlertTriangle aria-hidden="true" />
        <div>
          <strong>This time overlaps:</strong>
          <ul>
            {action?.conflicts.map((conflict) => (
              <li key={conflict.id}>
                {conflict.title} · {formatTime(conflict.startAt)}–
                {formatTime(conflict.endAt)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Dialog>
  );
}

function TimeSkeleton() {
  return (
    <div className="time-skeleton" aria-label="Loading personal time">
      <Panel tone="emphasis">
        <SkeletonLines rows={4} />
      </Panel>
      <Panel>
        <SkeletonLines rows={6} />
      </Panel>
    </div>
  );
}
