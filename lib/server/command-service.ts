import { buildAlerts, buildDailyBriefing } from "../domain/briefing";
import type {
  CommandData,
  Priority,
  SurfaceResult,
  TimelineItem,
} from "../domain/types";

export interface CommandSources {
  priorities(): Promise<Priority[]>;
  timeline(localDate: string, timeZone: string): Promise<TimelineItem[]>;
}

const defaultSources: CommandSources = {
  priorities: async () =>
    (await import("../../db/time-repository"))
      .listTimePriorities()
      .then((priorities) =>
        priorities.filter(
          (priority) =>
            priority.status === "active" &&
            priority.isTop !== false &&
            !priority.archivedAt,
        ),
      ),
  timeline: async (localDate, timeZone) =>
    (await import("../../db/time-repository")).listCommandTimeline(
      localDate,
      timeZone,
    ),
};

function result<T>(
  settled: PromiseSettledResult<T>,
  empty: T,
): SurfaceResult<T> {
  if (settled.status === "rejected") {
    return {
      state: "error",
      data: empty,
      error:
        "This section could not be loaded. Your other data is still available.",
    };
  }
  const value = settled.value;
  return {
    state: Array.isArray(value) && value.length === 0 ? "empty" : "loaded",
    data: value,
  };
}

export async function assembleCommandData(
  localDate: string,
  timeZone: string,
  sources: CommandSources = defaultSources,
  now = new Date(),
): Promise<CommandData> {
  const [prioritiesSettled, timelineSettled] = await Promise.allSettled([
    sources.priorities(),
    sources.timeline(localDate, timeZone),
  ]);

  const priorities = result(prioritiesSettled, [] as Priority[]);
  const timeline = result(timelineSettled, [] as TimelineItem[]);
  const alerts = buildAlerts(priorities.data, timeline.data, now);
  const briefing = buildDailyBriefing(
    priorities.data,
    timeline.data,
    alerts,
    now,
  );
  const partial =
    priorities.state === "error" || timeline.state === "error"
      ? "partial"
      : "loaded";

  return {
    date: localDate,
    timeZone,
    sourceLabel: "Private local workspace",
    lastUpdatedAt: now.toISOString(),
    priorities,
    timeline,
    protocol: {
      state: "empty",
      data: {
        configured: false,
        dueNow: 0,
        upcoming: 0,
        completedToday: 0,
      },
    },
    performance: {
      state: "unavailable",
      data: {
        workoutPlanned: null,
        lastWorkout: null,
        sleepDurationMinutes: null,
        sleepQuality: null,
        recovery: null,
      },
    },
    alerts: {
      state: alerts.length ? partial : "empty",
      data: alerts,
      ...(partial === "partial"
        ? { error: "Alerts may be incomplete while a section is unavailable." }
        : {}),
    },
    briefing: {
      state: partial,
      data: briefing,
      ...(partial === "partial"
        ? { error: "Briefing uses the data that is currently available." }
        : {}),
    },
    atlasAvailable: false,
  };
}
