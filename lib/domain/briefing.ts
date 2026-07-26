import type {
  CommandAlert,
  DailyBriefing,
  Priority,
  TimelineItem,
} from "./types";

function dueTimestamp(item: Priority) {
  return item.dueAt ? Date.parse(item.dueAt) : Number.POSITIVE_INFINITY;
}

export function buildAlerts(
  priorities: Priority[],
  timeline: TimelineItem[],
  now = new Date(),
): CommandAlert[] {
  const alerts: CommandAlert[] = [];
  const nowMs = now.getTime();

  const overduePriority = priorities
    .filter(
      (priority) =>
        priority.status === "active" &&
        priority.dueAt &&
        dueTimestamp(priority) < nowMs,
    )
    .sort((a, b) => dueTimestamp(a) - dueTimestamp(b))[0];

  if (overduePriority) {
    alerts.push({
      id: `priority-${overduePriority.id}`,
      kind: "overdue",
      severity: "attention",
      title: "Priority needs review",
      detail: `${overduePriority.title} is past its due time.`,
    });
  }

  const overdueRoutine = timeline.find(
    (item) =>
      item.kind === "routine" &&
      item.status === "scheduled" &&
      item.startAt &&
      Date.parse(item.startAt) < nowMs,
  );

  if (overdueRoutine) {
    alerts.push({
      id: `routine-${overdueRoutine.id}`,
      kind: "review",
      severity: "attention",
      title: "Routine is waiting",
      detail: `${overdueRoutine.title} is still open.`,
    });
  }

  return alerts.slice(0, 3);
}

export function buildDailyBriefing(
  priorities: Priority[],
  timeline: TimelineItem[],
  alerts: CommandAlert[],
  now = new Date(),
): DailyBriefing {
  const active = priorities
    .filter((priority) => priority.status === "active")
    .sort((a, b) => a.position - b.position);
  const upcoming = timeline
    .filter(
      (item) =>
        item.status === "scheduled" &&
        item.startAt &&
        Date.parse(item.startAt) >= now.getTime(),
    )
    .sort(
      (a, b) => Date.parse(a.startAt ?? "") - Date.parse(b.startAt ?? ""),
    )[0];

  if (!active.length && !timeline.length) {
    return {
      eyebrow: "Your day is open",
      summary:
        "Nothing is scheduled yet. Add one meaningful priority to give the day a clear direction.",
      nextStep: "Choose the one outcome that would make today count.",
      nextCommitment: null,
      facts: ["No priorities set", "No timeline items"],
    };
  }

  const summary = alerts.length
    ? `${alerts[0].title}. ${active.length ? `${active.length} active ${active.length === 1 ? "priority" : "priorities"} remain.` : "Your priority list is clear."}`
    : active.length
      ? `Your focus is ${active[0].title}. ${active.length === 1 ? "One priority is active." : `${active.length} priorities are active.`}`
      : "Your priorities are clear. Stay with the next scheduled commitment.";

  return {
    eyebrow: alerts.length ? "Attention first" : "Today at a glance",
    summary,
    nextStep: active[0]
      ? `Start with ${active[0].title}.`
      : upcoming
        ? `Prepare for ${upcoming.title}.`
        : "Protect the open space for focused work.",
    nextCommitment: upcoming?.title ?? null,
    facts: [
      `${active.length} active ${active.length === 1 ? "priority" : "priorities"}`,
      upcoming ? `Next: ${upcoming.title}` : "No upcoming timed item",
    ],
  };
}
