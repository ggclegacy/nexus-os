"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  Cake,
  Check,
  CheckCircle2,
  Dumbbell,
  ExternalLink,
  HeartPulse,
  Repeat2,
  RotateCcw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/Feedback";
import { Panel, SectionHeader } from "../ui/Panel";
import {
  attentionNeeded,
  eventsForDate,
  nextCalendarEvent,
  todayMission,
  upcomingCalendarRisks,
} from "../../lib/time/calendar-selectors";
import { eventIsActionable, eventTypeLabel } from "../../lib/time/event-types";
import { localDateInZone, zonedDateTimeToUtc } from "../../lib/time/rules";
import type {
  CalendarEvent,
  CalendarEventType,
  CalendarPayload,
  EventStatus,
  RoutineOccurrence,
} from "../../lib/time/types";
import type { Priority } from "../../lib/domain/types";

const typeIcons: Record<CalendarEventType, typeof CalendarClock> = {
  personal: CalendarClock,
  medical: HeartPulse,
  financial: Banknote,
  meeting: Users,
  workout: Dumbbell,
  protocol: ShieldCheck,
  family: Users,
  birthday: Cake,
  travel: CalendarClock,
  reminder: AlertTriangle,
  custom: CalendarClock,
};

function formatTime(value: string | null, hourCycle: "12" | "24") {
  if (!value) return "Any time";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: hourCycle === "24" ? "h23" : "h12",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

function relativeDuration(milliseconds: number) {
  const minutes = Math.max(0, Math.round(milliseconds / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function eventAmount(event: CalendarEvent) {
  if (event.amount === null) return null;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: event.currency,
  }).format(event.amount);
}

function focusTarget(id: string) {
  const target = document.getElementById(id);
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
  target?.focus({ preventScroll: true });
}

export function CalendarToday({
  data,
  date,
  onOpenEvent,
  onOpenPriority,
  onEventStatus,
  onPayment,
  onReschedule,
  onOccurrence,
  onAdd,
}: {
  data: CalendarPayload;
  date: string;
  onOpenEvent(event: CalendarEvent): void;
  onOpenPriority(priority: Priority): void;
  onEventStatus(event: CalendarEvent, status: EventStatus): void;
  onPayment(event: CalendarEvent, paymentStatus: "paid" | "unpaid"): void;
  onReschedule(event: CalendarEvent): void;
  onOccurrence(
    occurrence: RoutineOccurrence,
    status: "due" | "completed" | "skipped",
  ): void;
  onAdd(): void;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const isToday = date === localDateInZone(now, data.preferences.timeZone);
  const dayEvents = useMemo(
    () => eventsForDate(data.events, date),
    [data.events, date],
  );
  const next = isToday ? nextCalendarEvent(dayEvents, now) : null;
  const attention = isToday ? attentionNeeded(dayEvents, now) : [];
  const mission = isToday ? todayMission(data, now).slice(0, 5) : [];
  const upcoming = upcomingCalendarRisks(data.events, date).filter(
    (event) => event.localDate !== date,
  );
  const occurrences = data.occurrences.filter(
    (occurrence) => occurrence.scheduledDate === date,
  );
  const priorities = data.priorities.filter(
    (priority) =>
      priority.status === "active" &&
      priority.dueAt &&
      localDateInZone(priority.dueAt, data.preferences.timeZone) === date,
  );
  const allDay = dayEvents.filter((event) => event.allDay);
  const timed = dayEvents.filter((event) => !event.allDay);
  const endOfDay = new Date(
    zonedDateTimeToUtc(date, "23:59", data.preferences.timeZone),
  );

  return (
    <div className="today-experience">
      {isToday ? (
        <>
          <section className="today-mission" aria-label="Today mission">
            <SectionHeader
              eyebrow="Today mission"
              title="Keep the day in working memory"
              detail="Top priorities, time-sensitive commitments, and the next useful action."
            />
            {mission.length ? (
              <div className="today-mission__items">
                {mission.map((item) => {
                  const priority =
                    item.kind === "priority"
                      ? data.priorities.find(
                          (candidate) => `priority-${candidate.id}` === item.id,
                        )
                      : undefined;
                  const targetId = item.event
                    ? `today-event-${item.event.occurrenceKey}`
                    : item.occurrence
                      ? `today-routine-${item.occurrence.id}`
                      : null;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.event) onOpenEvent(item.event);
                        else if (priority) onOpenPriority(priority);
                        else if (targetId) focusTarget(targetId);
                      }}
                    >
                      <span>{item.label}</span>
                      <strong>{item.detail}</strong>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="surface-note">
                No urgent mission items. The day is open for intentional work.
              </p>
            )}
          </section>

          <TimeAwareness
            now={now}
            next={next}
            hourCycle={data.preferences.hourCycle}
            endOfDay={endOfDay}
          />
        </>
      ) : null}

      {attention.length ? (
        <section className="attention-needed" aria-label="Attention needed">
          <SectionHeader
            eyebrow="Attention needed"
            title="These commitments have passed"
            detail="Nothing disappears until you decide what happened."
          />
          <div className="attention-needed__list">
            {attention.map((event) => (
              <article key={event.occurrenceKey}>
                <AlertTriangle aria-hidden="true" />
                <div>
                  <strong>{event.title}</strong>
                  <p>
                    Scheduled{" "}
                    {formatTime(event.startAt, data.preferences.hourCycle)}
                    {" · "}Still unresolved
                  </p>
                </div>
                <div className="item-actions">
                  <Button
                    variant="tertiary"
                    icon={<Check aria-hidden="true" />}
                    onClick={() => onEventStatus(event, "completed")}
                  >
                    Complete
                  </Button>
                  <Button
                    variant="tertiary"
                    icon={<CalendarClock aria-hidden="true" />}
                    onClick={() => onReschedule(event)}
                  >
                    Reschedule
                  </Button>
                  <Button
                    variant="tertiary"
                    onClick={() => onEventStatus(event, "dismissed")}
                  >
                    Dismiss
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="today-timeline" aria-label="Today timeline">
        <SectionHeader
          eyebrow={isToday ? "Today timeline" : "Day timeline"}
          title={formatDate(date)}
          detail={
            isToday
              ? "Current, next, and later commitments in one calm sequence."
              : "A chronological view of this day."
          }
          action={
            <Button
              variant="primary"
              icon={<CalendarClock aria-hidden="true" />}
              onClick={onAdd}
            >
              Quick Add
            </Button>
          }
        />

        {!dayEvents.length && !occurrences.length && !priorities.length ? (
          <Panel>
            <EmptyState
              title="This day is open"
              detail="Keep the space unscheduled or add one meaningful commitment."
              action={
                <Button variant="primary" onClick={onAdd}>
                  Add event
                </Button>
              }
            />
          </Panel>
        ) : (
          <ol className="today-timeline__list">
            {allDay.map((event) => (
              <li key={event.occurrenceKey}>
                <TodayEventCard
                  event={event}
                  now={now}
                  next={next}
                  hourCycle={data.preferences.hourCycle}
                  onOpen={() => onOpenEvent(event)}
                  onStatus={(status) => onEventStatus(event, status)}
                  onPayment={(status) => onPayment(event, status)}
                />
              </li>
            ))}
            {[...timed, ...occurrences, ...priorities]
              .sort((left, right) => {
                const leftTime =
                  "startAt" in left
                    ? left.startAt
                    : "scheduledAt" in left
                      ? left.scheduledAt
                      : left.dueAt;
                const rightTime =
                  "startAt" in right
                    ? right.startAt
                    : "scheduledAt" in right
                      ? right.scheduledAt
                      : right.dueAt;
                return (leftTime ?? "").localeCompare(rightTime ?? "");
              })
              .map((item) => {
                if ("occurrenceKey" in item) {
                  return (
                    <li key={item.occurrenceKey}>
                      <TodayEventCard
                        event={item}
                        now={now}
                        next={next}
                        hourCycle={data.preferences.hourCycle}
                        onOpen={() => onOpenEvent(item)}
                        onStatus={(status) => onEventStatus(item, status)}
                        onPayment={(status) => onPayment(item, status)}
                      />
                    </li>
                  );
                }
                if ("routineId" in item) {
                  return (
                    <li key={item.id}>
                      <TodayRoutineCard
                        occurrence={item}
                        hourCycle={data.preferences.hourCycle}
                        onChange={(status) => onOccurrence(item, status)}
                      />
                    </li>
                  );
                }
                return (
                  <li key={item.id}>
                    <button
                      id={`today-priority-${item.id}`}
                      className="today-priority"
                      onClick={() => onOpenPriority(item)}
                    >
                      <CheckCircle2 aria-hidden="true" />
                      <span>
                        <strong>{item.title}</strong>
                        <small>
                          Priority due ·{" "}
                          {formatTime(item.dueAt, data.preferences.hourCycle)}
                        </small>
                      </span>
                      {item.isTop !== false ? (
                        <Badge tone="gold">Top three</Badge>
                      ) : null}
                    </button>
                  </li>
                );
              })}
          </ol>
        )}
      </section>

      {upcoming.length ? (
        <section className="calendar-upcoming" aria-label="Upcoming">
          <SectionHeader
            eyebrow="Upcoming"
            title="Act before it becomes urgent"
            detail="Bills and appointments within 7 days; birthdays within 14."
          />
          <div className="calendar-upcoming__items">
            {upcoming.slice(0, 6).map((event) => {
              const Icon = typeIcons[event.eventType];
              return (
                <button
                  key={event.occurrenceKey}
                  onClick={() => onOpenEvent(event)}
                >
                  <Icon aria-hidden="true" />
                  <span>
                    <strong>{event.title}</strong>
                    <small>
                      {eventTypeLabel(event.eventType)} ·{" "}
                      {formatDate(event.localDate)}
                      {eventAmount(event) ? ` · ${eventAmount(event)}` : ""}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function TimeAwareness({
  now,
  next,
  hourCycle,
  endOfDay,
}: {
  now: Date;
  next: CalendarEvent | null;
  hourCycle: "12" | "24";
  endOfDay: Date;
}) {
  const untilNext = next?.startAt
    ? Date.parse(next.startAt) - now.getTime()
    : null;
  return (
    <section className="time-awareness" aria-label="Time awareness">
      <div className="time-awareness__now">
        <span>NOW</span>
        <strong>{formatTime(now.toISOString(), hourCycle)}</strong>
      </div>
      <div>
        <span>Next meaningful event</span>
        <strong>{next?.title ?? "No timed event ahead"}</strong>
        <small>
          {next
            ? `${formatTime(next.startAt, hourCycle)} · in ${relativeDuration(untilNext ?? 0)}`
            : "Your remaining time is currently open."}
        </small>
      </div>
      <div>
        <span>Next open block</span>
        <strong>
          {next && untilNext && untilNext > 30 * 60_000
            ? `${relativeDuration(untilNext)} available`
            : next
              ? "After the next commitment"
              : "Open through end of day"}
        </strong>
        <small>
          {relativeDuration(endOfDay.getTime() - now.getTime())} remains today
        </small>
      </div>
    </section>
  );
}

function TodayEventCard({
  event,
  now,
  next,
  hourCycle,
  onOpen,
  onStatus,
  onPayment,
}: {
  event: CalendarEvent;
  now: Date;
  next: CalendarEvent | null;
  hourCycle: "12" | "24";
  onOpen(): void;
  onStatus(status: EventStatus): void;
  onPayment(status: "paid" | "unpaid"): void;
}) {
  const Icon = typeIcons[event.eventType];
  const past = event.endAt
    ? Date.parse(event.endAt) < now.getTime()
    : event.startAt
      ? Date.parse(event.startAt) < now.getTime()
      : false;
  const current =
    event.startAt &&
    event.endAt &&
    Date.parse(event.startAt) <= now.getTime() &&
    Date.parse(event.endAt) >= now.getTime();
  const isNext = next?.occurrenceKey === event.occurrenceKey;
  const amount = eventAmount(event);
  return (
    <article
      id={`today-event-${event.occurrenceKey}`}
      tabIndex={-1}
      className={`today-event ${past ? "is-past" : ""} ${
        current ? "is-current" : ""
      } ${isNext ? "is-next" : ""} today-event--${event.priority} today-event--type-${event.eventType}`}
    >
      <button className="today-event__main" onClick={onOpen}>
        <span className="today-event__time">
          {event.allDay ? "All day" : formatTime(event.startAt, hourCycle)}
        </span>
        <span className="today-event__icon">
          <Icon aria-hidden="true" />
        </span>
        <span className="today-event__copy">
          <span className="today-event__title">
            <strong>{event.title}</strong>
            {current ? <Badge tone="success">Now</Badge> : null}
            {isNext ? <Badge tone="gold">Next</Badge> : null}
            {event.status !== "scheduled" ? (
              <Badge tone="neutral">{event.status}</Badge>
            ) : null}
          </span>
          <small>
            {eventTypeLabel(event.eventType)}
            {event.location ? ` · ${event.location}` : ""}
            {amount ? ` · ${amount}` : ""}
          </small>
        </span>
      </button>
      <div className="item-actions">
        {event.meetingUrl ? (
          <a
            className="icon-link"
            href={event.meetingUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open meeting link for ${event.title}`}
          >
            <ExternalLink aria-hidden="true" />
          </a>
        ) : null}
        {event.eventType === "financial" && event.paymentStatus ? (
          <Button
            variant="tertiary"
            onClick={() =>
              onPayment(event.paymentStatus === "paid" ? "unpaid" : "paid")
            }
          >
            {event.paymentStatus === "paid" ? "Mark unpaid" : "Mark paid"}
          </Button>
        ) : eventIsActionable(event.eventType) &&
          event.status === "scheduled" ? (
          <Button
            variant="tertiary"
            icon={<Check aria-hidden="true" />}
            onClick={() => onStatus("completed")}
          >
            Complete
          </Button>
        ) : event.status === "completed" ? (
          <Button
            variant="icon"
            aria-label={`Restore ${event.title}`}
            icon={<RotateCcw aria-hidden="true" />}
            onClick={() => onStatus("scheduled")}
          />
        ) : null}
      </div>
    </article>
  );
}

function TodayRoutineCard({
  occurrence,
  hourCycle,
  onChange,
}: {
  occurrence: RoutineOccurrence;
  hourCycle: "12" | "24";
  onChange(status: "due" | "completed" | "skipped"): void;
}) {
  return (
    <article
      id={`today-routine-${occurrence.id}`}
      tabIndex={-1}
      className="today-routine"
    >
      <span className="today-event__time">
        {formatTime(occurrence.scheduledAt, hourCycle)}
      </span>
      <Repeat2 aria-hidden="true" />
      <span>
        <strong>{occurrence.routineName}</strong>
        <small>Routine · {occurrence.status}</small>
      </span>
      <div className="item-actions">
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
            <Button variant="tertiary" onClick={() => onChange("skipped")}>
              Skip
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
