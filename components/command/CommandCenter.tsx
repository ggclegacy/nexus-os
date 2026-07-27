"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarPlus,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { NexusEmblem } from "../brand/NexusEmblem";
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
  browserCommandApi,
  type CommandApi,
} from "../../lib/client/command-api";
import type {
  CommandData,
  Priority,
  PriorityInput,
  TimelineInput,
  TimelineItem,
} from "../../lib/domain/types";

type Editor =
  | { type: "priority"; item?: Priority }
  | { type: "timeline"; item?: TimelineItem }
  | { type: "capture" }
  | { type: "quick-add" }
  | null;

function localDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function detectedTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function formatTime(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDue(value: string | null) {
  if (!value) return "No due time";
  return `Due ${formatTime(value)}`;
}

function exactDate(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function replacePriority(data: CommandData, priority: Priority) {
  const exists = data.priorities.data.some((item) => item.id === priority.id);
  const priorities = exists
    ? data.priorities.data.map((item) =>
        item.id === priority.id ? priority : item,
      )
    : [...data.priorities.data, priority];
  return {
    ...data,
    priorities: {
      ...data.priorities,
      state: priorities.length ? ("loaded" as const) : ("empty" as const),
      data: priorities,
    },
  };
}

function replaceTimeline(data: CommandData, item: TimelineItem) {
  const exists = data.timeline.data.some((entry) => entry.id === item.id);
  const timeline = exists
    ? data.timeline.data.map((entry) => (entry.id === item.id ? item : entry))
    : [...data.timeline.data, item];
  return {
    ...data,
    timeline: {
      ...data.timeline,
      state: timeline.length ? ("loaded" as const) : ("empty" as const),
      data: timeline,
    },
  };
}

export function CommandCenter({
  api = browserCommandApi,
}: {
  api?: CommandApi;
}) {
  const [data, setData] = useState<CommandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const dateKey = localDateKey(now);
  const timeZone = detectedTimeZone();

  const load = useCallback(
    async (initial = false, signal?: AbortSignal) => {
      if (initial) setLoading(true);
      else setRefreshing(true);
      setPageError(null);
      try {
        const next = await api.load(dateKey, timeZone, signal);
        setData(next);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setPageError(
          error instanceof Error
            ? error.message
            : "Command could not be loaded. Try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api, dateKey, timeZone],
  );

  useEffect(() => {
    const controller = new AbortController();
    const loadTimer = window.setTimeout(() => {
      void load(true, controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(loadTimer);
      controller.abort();
    };
  }, [load]);

  useEffect(() => {
    const updateConnection = () => setOffline(!navigator.onLine);
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
      window.clearInterval(interval);
    };
  }, []);

  const stale =
    data !== null &&
    now.getTime() - Date.parse(data.lastUpdatedAt) > 5 * 60 * 1000;

  const notify = useCallback(
    (message: string, action?: Omit<ToastMessage, "id" | "message">) => {
      setToast({
        id: crypto.randomUUID(),
        message,
        ...action,
      });
    },
    [],
  );

  const savePriority = async (input: PriorityInput, item?: Priority) => {
    const priority = item
      ? await api.updatePriority(item.id, input)
      : await api.createPriority(input);
    setData((current) =>
      current ? replacePriority(current, priority) : current,
    );
    setEditor(null);
    notify(item ? "Priority updated." : "Priority added.");
    await load(false);
  };

  const togglePriority = async (priority: Priority) => {
    if (!data) return;
    const previous = data;
    const status = priority.status === "active" ? "completed" : "active";
    setData(
      replacePriority(data, {
        ...priority,
        status,
        completedAt: status === "completed" ? new Date().toISOString() : null,
      }),
    );
    try {
      const updated = await api.updatePriority(priority.id, { status });
      setData((current) =>
        current ? replacePriority(current, updated) : current,
      );
      notify(
        status === "completed" ? "Priority completed." : "Priority restored.",
        {
          actionLabel: "Undo",
          onAction: async () => {
            const restored = await api.updatePriority(priority.id, {
              status: priority.status,
            });
            setData((current) =>
              current ? replacePriority(current, restored) : current,
            );
          },
        },
      );
      await load(false);
    } catch (error) {
      setData(previous);
      notify(error instanceof Error ? error.message : "Change was not saved.");
    }
  };

  const deletePriorityItem = async (priority: Priority) => {
    try {
      await api.deletePriority(priority.id);
      setData((current) =>
        current
          ? {
              ...current,
              priorities: {
                ...current.priorities,
                data: current.priorities.data.filter(
                  (item) => item.id !== priority.id,
                ),
              },
            }
          : current,
      );
      notify("Priority removed.", {
        actionLabel: "Undo",
        onAction: async () => {
          const restored = await api.updatePriority(priority.id, {
            archived: false,
          });
          setData((current) =>
            current ? replacePriority(current, restored) : current,
          );
        },
      });
      await load(false);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Priority was not removed.",
      );
    }
  };

  const movePriority = async (priority: Priority, direction: -1 | 1) => {
    if (!data) return;
    const active = data.priorities.data
      .filter((item) => item.status === "active" && item.isTop !== false)
      .sort((a, b) => a.position - b.position);
    const index = active.findIndex((item) => item.id === priority.id);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= active.length) return;
    const reordered = [...active];
    [reordered[index], reordered[nextIndex]] = [
      reordered[nextIndex],
      reordered[index],
    ];
    const previous = data;
    setData({
      ...data,
      priorities: {
        ...data.priorities,
        data: [
          ...reordered.map((item, position) => ({ ...item, position })),
          ...data.priorities.data.filter((item) => item.status === "completed"),
        ],
      },
    });
    try {
      await api.reorderPriorities(reordered.map((item) => item.id));
      notify("Priority order updated.");
      await load(false);
    } catch (error) {
      setData(previous);
      notify(error instanceof Error ? error.message : "Order was not saved.");
    }
  };

  const saveTimeline = async (input: TimelineInput, item?: TimelineItem) => {
    const saved = item
      ? await api.updateTimeline(item.id, input)
      : await api.createTimeline(input);
    setData((current) => (current ? replaceTimeline(current, saved) : current));
    setEditor(null);
    notify(item ? "Timeline item updated." : "Timeline item added.");
    await load(false);
  };

  const setRoutineStatus = async (
    item: TimelineItem,
    status: "completed" | "skipped" | "scheduled",
  ) => {
    if (!data) return;
    const previous = data;
    setData(replaceTimeline(data, { ...item, status }));
    try {
      const updated = await api.updateTimeline(item.id, { status });
      setData((current) =>
        current ? replaceTimeline(current, updated) : current,
      );
      notify(
        status === "scheduled" ? "Routine restored." : `Routine ${status}.`,
        {
          actionLabel: "Undo",
          onAction: async () => {
            const restored = await api.updateTimeline(item.id, {
              status: item.status,
            });
            setData((current) =>
              current ? replaceTimeline(current, restored) : current,
            );
          },
        },
      );
      await load(false);
    } catch (error) {
      setData(previous);
      notify(error instanceof Error ? error.message : "Change was not saved.");
    }
  };

  const deleteTimeline = async (item: TimelineItem) => {
    try {
      await api.deleteTimeline(item.id);
      setData((current) =>
        current
          ? {
              ...current,
              timeline: {
                ...current.timeline,
                data: current.timeline.data.filter(
                  (entry) => entry.id !== item.id,
                ),
              },
            }
          : current,
      );
      notify("Timeline item removed.", {
        actionLabel: "Undo",
        onAction: async () => {
          const restored = await api.createTimeline({
            title: item.title,
            kind: item.kind,
            startAt: item.startAt,
            endAt: item.endAt,
            localDate: item.localDate,
            timeZone: item.timeZone,
            notes: item.notes,
          });
          setData((current) =>
            current ? replaceTimeline(current, restored) : current,
          );
        },
      });
      await load(false);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Timeline item was not removed.",
      );
    }
  };

  const saveCapture = async (content: string) => {
    await api.createCapture(content);
    setEditor(null);
    notify("Note captured in your local workspace.");
  };

  return (
    <AppShell onQuickAdd={() => setEditor({ type: "quick-add" })}>
      <ConnectionNotice offline={offline} stale={stale} />
      <div className="command-page">
        <CommandHeader
          now={now}
          sourceLabel={data?.sourceLabel}
          lastUpdatedAt={data?.lastUpdatedAt}
          refreshing={refreshing}
          onRefresh={() => void load(false)}
          onAdd={() => setEditor({ type: "quick-add" })}
        />

        {pageError && !data ? (
          <Panel>
            <ErrorState
              title="Command is unavailable"
              detail={pageError}
              onRetry={() => void load(true)}
            />
          </Panel>
        ) : loading || !data ? (
          <CommandSkeleton />
        ) : (
          <div className="command-grid">
            <div className="command-primary">
              <BriefingPanel data={data} />
              <PriorityPanel
                data={data}
                onAdd={() => setEditor({ type: "priority" })}
                onEdit={(item) => setEditor({ type: "priority", item })}
                onToggle={(item) => void togglePriority(item)}
                onDelete={(item) => void deletePriorityItem(item)}
                onMove={(item, direction) => void movePriority(item, direction)}
                onRetry={() => void load(false)}
              />
              <CommandAwareness data={data} now={now} />
              <TimelinePanel
                data={data}
                now={now}
                onAdd={() => setEditor({ type: "timeline" })}
                onEdit={(item) => setEditor({ type: "timeline", item })}
                onStatus={(item, status) => void setRoutineStatus(item, status)}
                onDelete={(item) => void deleteTimeline(item)}
                onRetry={() => void load(false)}
              />
            </div>
            <aside className="command-rail" aria-label="Daily context">
              <AlertsPanel data={data} />
              <ProtocolPanel data={data} />
              <PerformancePanel data={data} />
              <QuickActions
                onPriority={() => setEditor({ type: "priority" })}
                onTimeline={() => setEditor({ type: "timeline" })}
                onCapture={() => setEditor({ type: "capture" })}
              />
            </aside>
          </div>
        )}
      </div>

      <Editors
        editor={editor}
        dateKey={dateKey}
        timeZone={timeZone}
        onClose={() => setEditor(null)}
        onChoose={setEditor}
        onSavePriority={savePriority}
        onSaveTimeline={saveTimeline}
        onSaveCapture={saveCapture}
      />
      <ToastRegion toast={toast} onDismiss={() => setToast(null)} />
    </AppShell>
  );
}

function CommandHeader({
  now,
  sourceLabel,
  lastUpdatedAt,
  refreshing,
  onRefresh,
  onAdd,
}: {
  now: Date;
  sourceLabel?: string;
  lastUpdatedAt?: string;
  refreshing: boolean;
  onRefresh(): void;
  onAdd(): void;
}) {
  return (
    <header className="command-header">
      <div>
        <p className="eyebrow">Command center</p>
        <h1>{greeting(now)}</h1>
        <p className="command-header__date">{exactDate(now)}</p>
        <p className="command-header__status">
          {sourceLabel ?? "Loading your private workspace"}
          {lastUpdatedAt
            ? ` · Updated ${formatTime(lastUpdatedAt)?.toLowerCase()}`
            : ""}
        </p>
      </div>
      <div className="command-header__actions">
        <Button
          variant="icon"
          aria-label="Refresh Command"
          title="Refresh Command"
          loading={refreshing}
          onClick={onRefresh}
          icon={<RefreshCw aria-hidden="true" />}
        />
        <Button
          variant="primary"
          onClick={onAdd}
          icon={<Plus aria-hidden="true" />}
        >
          Quick add
        </Button>
      </div>
    </header>
  );
}

function BriefingPanel({ data }: { data: CommandData }) {
  return (
    <Panel
      tone="emphasis"
      className="briefing"
      aria-labelledby="briefing-title"
    >
      <NexusEmblem className="briefing__emblem" />
      <div className="briefing__body">
        <p className="eyebrow">Atlas briefing</p>
        <h2 id="briefing-title">{data.briefing.data.summary}</h2>
        <p className="briefing__next">{data.briefing.data.nextStep}</p>
        <div className="briefing__facts">
          {data.briefing.data.facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </div>
        {data.briefing.state === "partial" ? (
          <p className="surface-note">{data.briefing.error}</p>
        ) : null}
      </div>
      <Link className="briefing__atlas" href="/atlas">
        Atlas unavailable
        <ChevronRight aria-hidden="true" />
      </Link>
    </Panel>
  );
}

function relativeTime(milliseconds: number) {
  const minutes = Math.max(0, Math.round(milliseconds / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function CommandAwareness({ data, now }: { data: CommandData; now: Date }) {
  const scheduled = data.timeline.data
    .filter(
      (item) =>
        item.status === "scheduled" && item.kind !== "all-day" && item.startAt,
    )
    .sort(
      (left, right) =>
        Date.parse(left.startAt ?? "") - Date.parse(right.startAt ?? ""),
    );
  const current = scheduled.find(
    (item) =>
      Date.parse(item.startAt ?? "") <= now.getTime() &&
      (!item.endAt || Date.parse(item.endAt) >= now.getTime()),
  );
  const next = scheduled.find(
    (item) => Date.parse(item.startAt ?? "") > now.getTime(),
  );
  const following = next
    ? scheduled.find(
        (item) =>
          Date.parse(item.startAt ?? "") > Date.parse(next.startAt ?? ""),
      )
    : undefined;
  const untilNext = next?.startAt
    ? Date.parse(next.startAt) - now.getTime()
    : null;

  return (
    <section className="command-awareness" aria-label="Time awareness">
      <div className="command-awareness__now">
        <span>Now</span>
        <strong>{formatTime(now.toISOString())}</strong>
        <small>
          {current ? `In progress: ${current.title}` : "Open focus block"}
        </small>
      </div>
      <div>
        <span>Next</span>
        <strong>{next ? `Next: ${next.title}` : "No timed item ahead"}</strong>
        <small>
          {next
            ? `${formatTime(next.startAt)} · in ${relativeTime(untilNext ?? 0)}`
            : "The rest of the day is currently open."}
        </small>
      </div>
      <div>
        <span>{following ? "Following" : "Available window"}</span>
        <strong>
          {following
            ? `Later: ${following.title}`
            : untilNext && untilNext > 0
              ? `${relativeTime(untilNext)} before next`
              : next
                ? "Transition now"
                : "Unscheduled"}
        </strong>
        <small>
          {following
            ? `${formatTime(following.startAt)} · keep it in view`
            : "Protect the next useful block."}
        </small>
      </div>
    </section>
  );
}

function PriorityPanel({
  data,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
  onMove,
  onRetry,
}: {
  data: CommandData;
  onAdd(): void;
  onEdit(item: Priority): void;
  onToggle(item: Priority): void;
  onDelete(item: Priority): void;
  onMove(item: Priority, direction: -1 | 1): void;
  onRetry(): void;
}) {
  const active = data.priorities.data
    .filter((item) => item.status === "active" && item.isTop !== false)
    .sort((a, b) => a.position - b.position)
    .slice(0, 3);
  const completed = data.priorities.data.filter(
    (item) => item.status === "completed",
  );

  return (
    <Panel className="command-priorities" aria-labelledby="priorities-title">
      <SectionHeader
        eyebrow="Today mission"
        title="Top priorities"
        action={
          <Button
            variant="tertiary"
            onClick={onAdd}
            disabled={active.length >= 3}
            icon={<Plus aria-hidden="true" />}
          >
            Add
          </Button>
        }
      />
      <span id="priorities-title" className="sr-only">
        Top priorities
      </span>
      {data.priorities.state === "error" ? (
        <ErrorState detail={data.priorities.error ?? ""} onRetry={onRetry} />
      ) : active.length ? (
        <ol className="priority-list">
          {active.map((priority, index) => (
            <li className="priority-item" key={priority.id}>
              <button
                className="completion-control"
                onClick={() => onToggle(priority)}
                aria-label={`Complete ${priority.title}`}
              >
                <Check aria-hidden="true" />
              </button>
              <div className="priority-item__content">
                <span className="priority-item__index">0{index + 1}</span>
                <div>
                  <strong>{priority.title}</strong>
                  <span>{formatDue(priority.dueAt)}</span>
                </div>
              </div>
              <div className="item-actions">
                <Button
                  variant="icon"
                  aria-label={`Move ${priority.title} up`}
                  disabled={index === 0}
                  onClick={() => onMove(priority, -1)}
                  icon={<ArrowUp aria-hidden="true" />}
                />
                <Button
                  variant="icon"
                  aria-label={`Move ${priority.title} down`}
                  disabled={index === active.length - 1}
                  onClick={() => onMove(priority, 1)}
                  icon={<ArrowDown aria-hidden="true" />}
                />
                <Button
                  variant="icon"
                  aria-label={`Edit ${priority.title}`}
                  onClick={() => onEdit(priority)}
                  icon={<Pencil aria-hidden="true" />}
                />
                <Button
                  variant="icon"
                  aria-label={`Delete ${priority.title}`}
                  onClick={() => onDelete(priority)}
                  icon={<Trash2 aria-hidden="true" />}
                />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title="Set the direction"
          detail="Add up to three outcomes that deserve your attention today."
          action={
            <Button
              variant="primary"
              onClick={onAdd}
              icon={<Plus aria-hidden="true" />}
            >
              Add first priority
            </Button>
          }
        />
      )}
      {completed.length ? (
        <details className="completed-items">
          <summary>
            {completed.length} completed
            <ChevronRight aria-hidden="true" />
          </summary>
          <ul>
            {completed.slice(0, 5).map((priority) => (
              <li key={priority.id}>
                <span>{priority.title}</span>
                <Button
                  variant="tertiary"
                  onClick={() => onToggle(priority)}
                  icon={<RotateCcw aria-hidden="true" />}
                >
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Panel>
  );
}

function TimelinePanel({
  data,
  now,
  onAdd,
  onEdit,
  onStatus,
  onDelete,
  onRetry,
}: {
  data: CommandData;
  now: Date;
  onAdd(): void;
  onEdit(item: TimelineItem): void;
  onStatus(
    item: TimelineItem,
    status: "completed" | "skipped" | "scheduled",
  ): void;
  onDelete(item: TimelineItem): void;
  onRetry(): void;
}) {
  const items = useMemo(
    () =>
      [...data.timeline.data].sort((a, b) => {
        if (a.kind === "all-day") return -1;
        if (b.kind === "all-day") return 1;
        return Date.parse(a.startAt ?? "") - Date.parse(b.startAt ?? "");
      }),
    [data.timeline.data],
  );

  return (
    <Panel className="command-timeline" aria-labelledby="timeline-title">
      <SectionHeader
        eyebrow="Today"
        title="Timeline"
        action={
          <Button
            variant="tertiary"
            onClick={onAdd}
            icon={<CalendarPlus aria-hidden="true" />}
          >
            Add item
          </Button>
        }
      />
      <span id="timeline-title" className="sr-only">
        Today&apos;s timeline
      </span>
      {data.timeline.state === "error" ? (
        <ErrorState detail={data.timeline.error ?? ""} onRetry={onRetry} />
      ) : items.length ? (
        <ol className="timeline-list">
          {items.map((item) => {
            const start = item.startAt ? Date.parse(item.startAt) : null;
            const overdue =
              item.status === "scheduled" &&
              start !== null &&
              start < now.getTime();
            const upcoming =
              item.status === "scheduled" &&
              start !== null &&
              start >= now.getTime();
            return (
              <li
                className={`timeline-item timeline-item--${item.status} ${
                  overdue ? "timeline-item--overdue" : ""
                }`}
                key={item.id}
              >
                <time dateTime={item.startAt ?? item.localDate}>
                  {item.kind === "all-day"
                    ? "All day"
                    : formatTime(item.startAt)}
                </time>
                <span className="timeline-item__line" aria-hidden="true" />
                <div className="timeline-item__content">
                  <div>
                    <strong>{item.title}</strong>
                    <span>
                      {item.kind === "routine" ? "Routine" : "Personal event"}
                      {overdue
                        ? " · Needs review"
                        : upcoming
                          ? " · Upcoming"
                          : ""}
                    </span>
                  </div>
                  <Badge
                    tone={
                      item.status === "completed"
                        ? "success"
                        : item.status === "skipped"
                          ? "neutral"
                          : overdue
                            ? "warning"
                            : "info"
                    }
                  >
                    {item.status === "scheduled"
                      ? overdue
                        ? "Overdue"
                        : "Scheduled"
                      : item.status}
                  </Badge>
                </div>
                <div className="item-actions">
                  {item.kind === "routine" ? (
                    item.status === "scheduled" ? (
                      <>
                        <Button
                          variant="icon"
                          aria-label={`Complete ${item.title}`}
                          onClick={() => onStatus(item, "completed")}
                          icon={<Check aria-hidden="true" />}
                        />
                        <Button
                          variant="icon"
                          aria-label={`Skip ${item.title}`}
                          onClick={() => onStatus(item, "skipped")}
                          icon={<MoreHorizontal aria-hidden="true" />}
                        />
                      </>
                    ) : (
                      <Button
                        variant="icon"
                        aria-label={`Restore ${item.title}`}
                        onClick={() => onStatus(item, "scheduled")}
                        icon={<RotateCcw aria-hidden="true" />}
                      />
                    )
                  ) : null}
                  {item.isRecurring || item.kind === "routine" ? (
                    <Link
                      className="text-link"
                      href={`/calendar?view=day&date=${item.localDate}`}
                      aria-label={`Open ${item.title} in Calendar`}
                    >
                      Review in Calendar
                    </Link>
                  ) : (
                    <>
                      <Button
                        variant="icon"
                        aria-label={`Edit ${item.title}`}
                        onClick={() => onEdit(item)}
                        icon={<Pencil aria-hidden="true" />}
                      />
                      <Button
                        variant="icon"
                        aria-label={`Delete ${item.title}`}
                        onClick={() => onDelete(item)}
                        icon={<Trash2 aria-hidden="true" />}
                      />
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState
          title="Your timeline is open"
          detail="Add a personal event or routine to make today’s commitments visible."
          action={
            <Button
              variant="secondary"
              onClick={onAdd}
              icon={<CalendarPlus aria-hidden="true" />}
            >
              Add timeline item
            </Button>
          }
        />
      )}
    </Panel>
  );
}

function AlertsPanel({ data }: { data: CommandData }) {
  if (!data.alerts.data.length && data.alerts.state !== "partial") return null;
  return (
    <Panel className="alerts-panel" aria-labelledby="alerts-title">
      <SectionHeader eyebrow="Exceptions" title="Needs attention" />
      <span id="alerts-title" className="sr-only">
        Alerts and exceptions
      </span>
      {data.alerts.data.map((alert) => (
        <div className="alert-item" key={alert.id}>
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>{alert.title}</strong>
            <p>{alert.detail}</p>
          </div>
        </div>
      ))}
      {data.alerts.error ? (
        <p className="surface-note">{data.alerts.error}</p>
      ) : null}
    </Panel>
  );
}

function ProtocolPanel({ data }: { data: CommandData }) {
  return (
    <Panel tone="quiet">
      <SectionHeader eyebrow="Protocol" title="Due today" />
      {data.protocol.state === "error" ? (
        <ErrorState detail={data.protocol.error ?? ""} />
      ) : !data.protocol.data.configured ? (
        <EmptyState
          title="No protocol configured"
          detail="Nothing is assumed. Protocol setup arrives in a later phase."
        />
      ) : (
        <div className="metric-row">
          <Metric value={data.protocol.data.dueNow} label="Due now" />
          <Metric value={data.protocol.data.upcoming} label="Upcoming" />
          <Metric value={data.protocol.data.completedToday} label="Complete" />
        </div>
      )}
    </Panel>
  );
}

function PerformancePanel({ data }: { data: CommandData }) {
  return (
    <Panel tone="quiet">
      <SectionHeader eyebrow="Performance" title="Workout & recovery" />
      {data.performance.state === "unavailable" ? (
        <EmptyState
          title="No performance data yet"
          detail="Plan a workout or connect recovery records in their dedicated phases."
        />
      ) : (
        <div className="metric-row">
          <Metric
            value={data.performance.data.sleepDurationMinutes ?? "—"}
            label="Sleep"
          />
          <Metric
            value={data.performance.data.recovery ?? "—"}
            label="Recovery"
          />
        </div>
      )}
      <Link className="text-link" href="/fitness">
        Open prepared Fitness area <ChevronRight aria-hidden="true" />
      </Link>
    </Panel>
  );
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function QuickActions({
  onPriority,
  onTimeline,
  onCapture,
}: {
  onPriority(): void;
  onTimeline(): void;
  onCapture(): void;
}) {
  return (
    <Panel id="quick-actions" tone="quiet">
      <SectionHeader eyebrow="Capture" title="Quick actions" />
      <div className="quick-actions">
        <button onClick={onPriority}>
          <Check aria-hidden="true" />
          <span>Add priority</span>
        </button>
        <button onClick={onTimeline}>
          <Clock3 aria-hidden="true" />
          <span>Add timeline item</span>
        </button>
        <button onClick={onCapture}>
          <FileText aria-hidden="true" />
          <span>Capture note</span>
        </button>
        <Link href="/atlas" aria-label="Open Atlas unavailable state">
          <Sparkles aria-hidden="true" />
          <span>Open Atlas</span>
        </Link>
      </div>
    </Panel>
  );
}

function CommandSkeleton() {
  return (
    <div className="command-grid" aria-label="Loading Command">
      <div className="command-primary">
        <Panel tone="emphasis">
          <SkeletonLines rows={3} />
        </Panel>
        <Panel>
          <SkeletonLines rows={4} />
        </Panel>
        <Panel>
          <SkeletonLines rows={5} />
        </Panel>
      </div>
      <aside className="command-rail">
        <Panel>
          <SkeletonLines rows={3} />
        </Panel>
        <Panel>
          <SkeletonLines rows={3} />
        </Panel>
      </aside>
    </div>
  );
}

function Editors({
  editor,
  dateKey,
  timeZone,
  onClose,
  onChoose,
  onSavePriority,
  onSaveTimeline,
  onSaveCapture,
}: {
  editor: Editor;
  dateKey: string;
  timeZone: string;
  onClose(): void;
  onChoose(editor: Editor): void;
  onSavePriority(input: PriorityInput, item?: Priority): Promise<void>;
  onSaveTimeline(input: TimelineInput, item?: TimelineItem): Promise<void>;
  onSaveCapture(content: string): Promise<void>;
}) {
  return (
    <>
      <QuickAddDialog
        open={editor?.type === "quick-add"}
        onClose={onClose}
        onChoose={onChoose}
      />
      <PriorityDialog
        key={
          editor?.type === "priority"
            ? `priority-${editor.item?.id ?? "new"}`
            : "priority-closed"
        }
        open={editor?.type === "priority"}
        item={editor?.type === "priority" ? editor.item : undefined}
        onClose={onClose}
        onSave={onSavePriority}
      />
      <TimelineDialog
        key={
          editor?.type === "timeline"
            ? `timeline-${editor.item?.id ?? "new"}`
            : "timeline-closed"
        }
        open={editor?.type === "timeline"}
        item={editor?.type === "timeline" ? editor.item : undefined}
        dateKey={dateKey}
        timeZone={timeZone}
        onClose={onClose}
        onSave={onSaveTimeline}
      />
      <CaptureDialog
        open={editor?.type === "capture"}
        onClose={onClose}
        onSave={onSaveCapture}
      />
    </>
  );
}

function QuickAddDialog({
  open,
  onClose,
  onChoose,
}: {
  open: boolean;
  onClose(): void;
  onChoose(editor: Editor): void;
}) {
  return (
    <Dialog
      open={open}
      title="Quick add"
      description="Choose the smallest action that moves today forward."
      onClose={onClose}
    >
      <div className="quick-add-grid">
        <button onClick={() => onChoose({ type: "priority" })}>
          <span>
            <Check aria-hidden="true" />
          </span>
          <strong>Priority</strong>
          <small>Set one of today’s top three outcomes.</small>
        </button>
        <button onClick={() => onChoose({ type: "timeline" })}>
          <span>
            <CalendarPlus aria-hidden="true" />
          </span>
          <strong>Timeline item</strong>
          <small>Add a personal event or routine.</small>
        </button>
        <button onClick={() => onChoose({ type: "capture" })}>
          <span>
            <FileText aria-hidden="true" />
          </span>
          <strong>Quick note</strong>
          <small>Capture context without losing focus.</small>
        </button>
      </div>
    </Dialog>
  );
}

function PriorityDialog({
  open,
  item,
  onClose,
  onSave,
}: {
  open: boolean;
  item?: Priority;
  onClose(): void;
  onSave(input: PriorityInput, item?: Priority): Promise<void>;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [dueTime, setDueTime] = useState(
    item?.dueAt
      ? new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(item.dueAt))
      : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError("Enter a clear priority.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const dueAt = dueTime
        ? new Date(`${localDateKey()}T${dueTime}`).toISOString()
        : null;
      await onSave({ title: title.trim(), dueAt }, item);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Priority could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      title={item ? "Edit priority" : "Add priority"}
      description="Keep it concrete and achievable today."
      onClose={onClose}
      footer={
        <>
          <Button variant="tertiary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="priority-form"
            loading={saving}
          >
            {item ? "Save changes" : "Add priority"}
          </Button>
        </>
      }
    >
      <form id="priority-form" className="form" onSubmit={submit}>
        <label>
          <span>Priority</span>
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={160}
            placeholder="What outcome matters most?"
            aria-describedby={error ? "priority-error" : undefined}
          />
        </label>
        <label>
          <span>
            Due time <small>Optional</small>
          </span>
          <input
            type="time"
            value={dueTime}
            onChange={(event) => setDueTime(event.target.value)}
          />
        </label>
        {error ? (
          <p className="form-error" id="priority-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

function TimelineDialog({
  open,
  item,
  dateKey,
  timeZone,
  onClose,
  onSave,
}: {
  open: boolean;
  item?: TimelineItem;
  dateKey: string;
  timeZone: string;
  onClose(): void;
  onSave(input: TimelineInput, item?: TimelineItem): Promise<void>;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [kind, setKind] = useState<TimelineInput["kind"]>(
    item?.kind ?? "event",
  );
  const [date, setDate] = useState(item?.localDate ?? dateKey);
  const [startTime, setStartTime] = useState(
    item?.startAt ? formatTime24(item.startAt) : "09:00",
  );
  const [endTime, setEndTime] = useState(
    item?.endAt ? formatTime24(item.endAt) : "",
  );
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError("Enter a title for this timeline item.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const startAt =
        kind === "all-day"
          ? null
          : new Date(`${date}T${startTime}`).toISOString();
      const endAt =
        kind !== "all-day" && endTime
          ? new Date(`${date}T${endTime}`).toISOString()
          : null;
      if (startAt && endAt && Date.parse(endAt) <= Date.parse(startAt)) {
        throw new Error("End time must be after start time.");
      }
      await onSave(
        {
          title: title.trim(),
          kind,
          startAt,
          endAt,
          localDate: date,
          timeZone,
          notes,
        },
        item,
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Timeline item could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      title={item ? "Edit timeline item" : "Add timeline item"}
      description={`Times are stored unambiguously and shown in ${timeZone}.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="tertiary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="timeline-form"
            loading={saving}
          >
            {item ? "Save changes" : "Add to timeline"}
          </Button>
        </>
      }
    >
      <form id="timeline-form" className="form" onSubmit={submit}>
        <label>
          <span>Title</span>
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={160}
            placeholder="Personal commitment or routine"
            aria-describedby={error ? "timeline-error" : undefined}
          />
        </label>
        <fieldset>
          <legend>Type</legend>
          <div className="segmented-control">
            {(["event", "all-day", "routine"] as const).map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="timeline-kind"
                  value={value}
                  checked={kind === value}
                  onChange={() => setKind(value)}
                />
                <span>
                  {value === "event"
                    ? "Timed"
                    : value === "all-day"
                      ? "All day"
                      : "Routine"}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          <span>Date</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </label>
        {kind !== "all-day" ? (
          <div className="form-row">
            <label>
              <span>Start time</span>
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                required
              />
            </label>
            <label>
              <span>
                End time <small>Optional</small>
              </span>
              <input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </label>
          </div>
        ) : null}
        <label>
          <span>
            Notes <small>Optional</small>
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={1200}
            rows={3}
            placeholder="Location or useful context"
          />
        </label>
        {error ? (
          <p className="form-error" id="timeline-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

function CaptureDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose(): void;
  onSave(content: string): Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim()) {
      setError("Write something to capture.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(content.trim());
      setContent("");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Note could not be captured.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      title="Quick capture"
      description="Preserve a thought without turning it into a task."
      onClose={onClose}
      footer={
        <>
          <Button variant="tertiary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="capture-form"
            loading={saving}
          >
            Save note
          </Button>
        </>
      }
    >
      <form id="capture-form" className="form" onSubmit={submit}>
        <label>
          <span>Note</span>
          <textarea
            autoFocus
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={2000}
            rows={6}
            placeholder="What should you remember?"
            aria-describedby={error ? "capture-error" : undefined}
          />
        </label>
        {error ? (
          <p className="form-error" id="capture-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

function formatTime24(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}
