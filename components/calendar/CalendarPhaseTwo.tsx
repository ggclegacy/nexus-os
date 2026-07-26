"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Bell,
  CalendarClock,
  Cake,
  Check,
  ChevronRight,
  Clock3,
  Moon,
  RotateCcw,
  ShieldAlert,
  Sun,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { EmptyState } from "../ui/Feedback";
import { Panel, SectionHeader } from "../ui/Panel";
import {
  birthdayPlanning,
  billPlanning,
  calendarBrief,
  monthGrid,
  reminderBuckets,
  rescueCandidates,
  scheduleWarnings,
  snoozeTime,
} from "../../lib/time/phase-two";
import {
  addDays,
  localDateInZone,
  zonedDateTimeToUtc,
} from "../../lib/time/rules";
import type {
  CalendarEvent,
  CalendarPayload,
  EventStatus,
  ReminderInstance,
} from "../../lib/time/types";

function formatDate(
  value: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
  },
) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    ...options,
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatTime(value: string | null, hourCycle: "12" | "24") {
  if (!value) return "All day";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: hourCycle === "24" ? "h23" : "h12",
  }).format(new Date(value));
}

function eventForReminder(data: CalendarPayload, reminder: ReminderInstance) {
  return data.events.find(
    (event) => event.occurrenceKey === reminder.occurrenceKey,
  );
}

function briefEventTitle(event: CalendarEvent) {
  return event.sensitive ? "Sensitive event" : event.title;
}

export function CalendarSignals({
  data,
  now,
  onArea,
  onBrief,
  onRescue,
}: {
  data: CalendarPayload;
  now: Date;
  onArea(area: "reminders" | "birthdays" | "bills"): void;
  onBrief(mode: "morning" | "evening"): void;
  onRescue(): void;
}) {
  const today = localDateInZone(now, data.preferences.timeZone);
  const todayEvents = data.events.filter((event) => event.localDate === today);
  const warnings = scheduleWarnings(
    todayEvents,
    data.preferences.transitionBufferMinutes,
  );
  const reminders = reminderBuckets(data.reminderInstances, data.events, now);
  const rescue = rescueCandidates(data.events, now);
  const localTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: data.preferences.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const evening = localTime >= data.preferences.eveningBriefTime;
  return (
    <section className="calendar-signals" aria-label="Planning signals">
      <button onClick={() => onArea("reminders")}>
        <Bell aria-hidden="true" />
        <span>
          <strong>{reminders.needsAction.length} reminders need action</strong>
          <small>
            {reminders.snoozed.length} snoozed · {reminders.upcoming.length}{" "}
            upcoming
          </small>
        </span>
        <ChevronRight aria-hidden="true" />
      </button>
      {warnings.length ? (
        <button onClick={() => onArea("reminders")}>
          <ShieldAlert aria-hidden="true" />
          <span>
            <strong>
              {warnings.length} schedule warning
              {warnings.length === 1 ? "" : "s"}
            </strong>
            <small>{warnings[0].message}</small>
          </span>
          <ChevronRight aria-hidden="true" />
        </button>
      ) : null}
      <button onClick={() => onBrief(evening ? "evening" : "morning")}>
        {evening ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
        <span>
          <strong>{evening ? "Evening Brief" : "Morning Brief"}</strong>
          <small>Rule-based and linked to your Calendar records</small>
        </span>
        <ChevronRight aria-hidden="true" />
      </button>
      {rescue.length >= 2 ? (
        <button onClick={onRescue}>
          <RotateCcw aria-hidden="true" />
          <span>
            <strong>Rebuild the rest of today</strong>
            <small>{rescue.length} items need a decision</small>
          </span>
          <ChevronRight aria-hidden="true" />
        </button>
      ) : null}
    </section>
  );
}

export function MonthView({
  data,
  selectedDate,
  onSelectDate,
  onOpenEvent,
  onAdd,
}: {
  data: CalendarPayload;
  selectedDate: string;
  onSelectDate(date: string): void;
  onOpenEvent(event: CalendarEvent): void;
  onAdd(date: string): void;
}) {
  const grid = monthGrid(selectedDate, data.preferences.weekStartsOn);
  const today = localDateInZone(new Date(), data.preferences.timeZone);
  const selectedEvents = data.events.filter(
    (event) =>
      event.localDate <= selectedDate && event.endLocalDate >= selectedDate,
  );
  const labels =
    data.preferences.weekStartsOn === 1
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div className="month-workspace">
      <Panel>
        <SectionHeader
          eyebrow="Month"
          title={formatDate(selectedDate, { month: "long", year: "numeric" })}
          detail="Pattern recognition with important commitments kept visible."
        />
        <div className="month-grid" role="grid" aria-label="Month calendar">
          <div className="month-grid__row" role="row">
            {labels.map((label) => (
              <div
                className="month-grid__weekday"
                role="columnheader"
                key={label}
              >
                {label}
              </div>
            ))}
          </div>
          {Array.from({ length: 6 }, (_, week) => (
            <div className="month-grid__row" role="row" key={week}>
              {grid.dates.slice(week * 7, week * 7 + 7).map((date) => {
                const events = data.events
                  .filter(
                    (event) =>
                      event.localDate <= date && event.endLocalDate >= date,
                  )
                  .sort(
                    (left, right) =>
                      Number(right.priority === "critical") -
                        Number(left.priority === "critical") ||
                      Number(right.priority === "important") -
                        Number(left.priority === "important") ||
                      left.localDate.localeCompare(right.localDate),
                  );
                const visible = events.slice(0, 2);
                return (
                  <div
                    role="gridcell"
                    key={date}
                    className={`month-day ${
                      date.slice(0, 7) !== selectedDate.slice(0, 7)
                        ? "is-outside"
                        : ""
                    } ${date === today ? "is-today" : ""} ${
                      date === selectedDate ? "is-selected" : ""
                    }`}
                  >
                    <button
                      className="month-day__date"
                      aria-label={`Select ${formatDate(date)}`}
                      aria-pressed={date === selectedDate}
                      onClick={() => onSelectDate(date)}
                      onKeyDown={(event) => {
                        const offset =
                          event.key === "ArrowLeft"
                            ? -1
                            : event.key === "ArrowRight"
                              ? 1
                              : event.key === "ArrowUp"
                                ? -7
                                : event.key === "ArrowDown"
                                  ? 7
                                  : 0;
                        if (!offset) return;
                        event.preventDefault();
                        onSelectDate(addDays(date, offset));
                      }}
                    >
                      {Number(date.slice(8, 10))}
                      {date === today ? <span>Today</span> : null}
                    </button>
                    <div className="month-day__events">
                      {visible.map((item) => (
                        <button
                          key={item.occurrenceKey}
                          className={`month-event month-event--${item.priority}`}
                          onClick={() => onOpenEvent(item)}
                        >
                          {item.eventType === "birthday" ? (
                            <Cake aria-hidden="true" />
                          ) : item.eventType === "financial" ? (
                            <Banknote aria-hidden="true" />
                          ) : (
                            <CalendarClock aria-hidden="true" />
                          )}
                          <span>{item.title}</span>
                        </button>
                      ))}
                      {events.length > 2 ? (
                        <button
                          className="month-day__more"
                          onClick={() => onSelectDate(date)}
                        >
                          +{events.length - 2} more
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <SectionHeader
          eyebrow="Selected day"
          title={formatDate(selectedDate)}
          action={
            <Button variant="primary" onClick={() => onAdd(selectedDate)}>
              Add event
            </Button>
          }
        />
        {selectedEvents.length ? (
          <div className="selected-day-list">
            {selectedEvents.map((event) => (
              <button
                key={event.occurrenceKey}
                onClick={() => onOpenEvent(event)}
              >
                <span>
                  {formatTime(event.startAt, data.preferences.hourCycle)}
                </span>
                <strong>{event.title}</strong>
                <Badge
                  tone={event.priority === "critical" ? "danger" : "neutral"}
                >
                  {event.eventType}
                </Badge>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title="This date is open"
            detail="Select Add event to place a commitment here."
          />
        )}
      </Panel>
    </div>
  );
}

export function ReminderCenter({
  data,
  now,
  onOpen,
  onStatus,
  onPayment,
  onReschedule,
  onReminder,
}: {
  data: CalendarPayload;
  now: Date;
  onOpen(event: CalendarEvent): void;
  onStatus(event: CalendarEvent, status: EventStatus): void;
  onPayment(event: CalendarEvent, status: "paid" | "unpaid"): void;
  onReschedule(event: CalendarEvent): void;
  onReminder(
    reminder: ReminderInstance,
    action: "seen" | "snooze" | "resolve" | "dismiss",
    snoozedUntil?: string,
  ): void;
}) {
  const buckets = reminderBuckets(data.reminderInstances, data.events, now);
  const [customSnooze, setCustomSnooze] = useState<Record<string, string>>({});
  const sections = [
    ["Needs Action", buckets.needsAction],
    ["Snoozed", buckets.snoozed],
    ["Upcoming", buckets.upcoming],
    ["Resolved history", buckets.resolved.slice(-20).reverse()],
  ] as const;
  return (
    <div className="reminder-center">
      <Panel>
        <SectionHeader
          eyebrow="Reminder Center"
          title="Every reminder has a resolution path"
          detail="In-app delivery only. No email, SMS, or device notification is being claimed."
        />
        {sections.map(([label, reminders]) => (
          <section key={label} aria-label={label}>
            <header className="planning-section-header">
              <h2>{label}</h2>
              <Badge tone={label === "Needs Action" ? "gold" : "neutral"}>
                {reminders.length}
              </Badge>
            </header>
            {reminders.length ? (
              <div className="reminder-list">
                {reminders.map((reminder) => {
                  const event = eventForReminder(data, reminder);
                  if (!event) return null;
                  return (
                    <article key={reminder.id}>
                      <Bell aria-hidden="true" />
                      <div>
                        <strong>{event.title}</strong>
                        <p>
                          {formatDate(event.localDate)} ·{" "}
                          {formatTime(
                            event.startAt,
                            data.preferences.hourCycle,
                          )}
                        </p>
                        <small>{reminder.reason}</small>
                        <small>{reminder.ruleLabel}</small>
                        {reminder.nextEscalationAt ? (
                          <small>
                            Next limited escalation{" "}
                            {formatTime(
                              reminder.nextEscalationAt,
                              data.preferences.hourCycle,
                            )}
                          </small>
                        ) : null}
                      </div>
                      <div className="reminder-actions">
                        <Button
                          variant="tertiary"
                          onClick={() => {
                            if (reminder.state === "delivered")
                              onReminder(reminder, "seen");
                            onOpen(event);
                          }}
                        >
                          Open
                        </Button>
                        {event.eventType === "financial" &&
                        event.paymentStatus !== "paid" ? (
                          <Button
                            variant="tertiary"
                            onClick={() => onPayment(event, "paid")}
                          >
                            Mark paid
                          </Button>
                        ) : event.status === "scheduled" ? (
                          <Button
                            variant="tertiary"
                            icon={<Check aria-hidden="true" />}
                            onClick={() => onStatus(event, "completed")}
                          >
                            Complete
                          </Button>
                        ) : null}
                        {!["resolved", "dismissed", "expired"].includes(
                          reminder.state,
                        ) ? (
                          <>
                            <details className="snooze-menu">
                              <summary>Snooze</summary>
                              <div>
                                {(
                                  [
                                    ["15m", "15 minutes"],
                                    ["1h", "1 hour"],
                                    ["later-today", "Later today"],
                                    ["tomorrow", "Tomorrow morning"],
                                  ] as const
                                ).map(([choice, text]) => (
                                  <button
                                    key={choice}
                                    onClick={() =>
                                      onReminder(
                                        reminder,
                                        "snooze",
                                        snoozeTime(
                                          choice,
                                          now,
                                          data.preferences.timeZone,
                                        ),
                                      )
                                    }
                                  >
                                    {text}
                                  </button>
                                ))}
                                <label>
                                  <span>Custom date and time</span>
                                  <input
                                    type="datetime-local"
                                    value={customSnooze[reminder.id] ?? ""}
                                    onChange={(change) =>
                                      setCustomSnooze((current) => ({
                                        ...current,
                                        [reminder.id]: change.target.value,
                                      }))
                                    }
                                  />
                                </label>
                                <button
                                  disabled={!customSnooze[reminder.id]}
                                  onClick={() => {
                                    const value = customSnooze[reminder.id];
                                    if (!value) return;
                                    const [date, time] = value.split("T");
                                    onReminder(
                                      reminder,
                                      "snooze",
                                      zonedDateTimeToUtc(
                                        date,
                                        time,
                                        data.preferences.timeZone,
                                      ),
                                    );
                                  }}
                                >
                                  Snooze until custom time
                                </button>
                              </div>
                            </details>
                            <Button
                              variant="tertiary"
                              onClick={() => onReschedule(event)}
                            >
                              Reschedule
                            </Button>
                            <Button
                              variant="tertiary"
                              onClick={() => onReminder(reminder, "dismiss")}
                            >
                              Dismiss
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="surface-note">Nothing in this state.</p>
            )}
          </section>
        ))}
      </Panel>
    </div>
  );
}

export function BirthdayPlanner({
  data,
  date,
  onOpen,
  onAdd,
}: {
  data: CalendarPayload;
  date: string;
  onOpen(event: CalendarEvent): void;
  onAdd(date: string): void;
}) {
  const birthdays = birthdayPlanning(data.events, date);
  return (
    <Panel>
      <SectionHeader
        eyebrow="Birthday planning"
        title="Make space for the people who matter"
        detail="Leap-day birthdays appear on February 28 in non-leap years."
        action={
          <Button variant="primary" onClick={() => onAdd(date)}>
            Add birthday
          </Button>
        }
      />
      {birthdays.length ? (
        ["Next 14 days", "Next 30 days", "Later this year"].map((horizon) => {
          const items = birthdays.filter((item) => item.horizon === horizon);
          if (!items.length) return null;
          return (
            <section key={horizon} aria-label={horizon}>
              <header className="planning-section-header">
                <h2>{horizon}</h2>
                <Badge tone="neutral">{items.length}</Badge>
              </header>
              <div className="planner-list">
                {items.map(({ event, age }) => (
                  <article key={event.occurrenceKey}>
                    <Cake aria-hidden="true" />
                    <div>
                      <strong>{event.title}</strong>
                      <p>
                        {formatDate(event.localDate)}
                        {age ? ` · Turns ${age}` : ""}
                        {event.relationship ? ` · ${event.relationship}` : ""}
                      </p>
                      {event.giftIdea ? (
                        <small>Gift note: {event.giftIdea}</small>
                      ) : null}
                      {event.contactMethod ? (
                        <small>Preferred contact: {event.contactMethod}</small>
                      ) : null}
                    </div>
                    <div className="item-actions">
                      <Button variant="tertiary" onClick={() => onOpen(event)}>
                        {event.giftIdea ? "Edit gift note" : "Add gift note"}
                      </Button>
                      <Button
                        variant="tertiary"
                        icon={<Clock3 aria-hidden="true" />}
                        onClick={() => onAdd(event.localDate)}
                      >
                        Schedule call
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })
      ) : (
        <EmptyState
          title="No birthdays in this horizon"
          detail="Add a birthday to create a discreet annual planning record."
        />
      )}
    </Panel>
  );
}

export function BillPlanner({
  data,
  date,
  onOpen,
  onPayment,
  onAdd,
}: {
  data: CalendarPayload;
  date: string;
  onOpen(event: CalendarEvent): void;
  onPayment(event: CalendarEvent, status: "paid" | "unpaid"): void;
  onAdd(date: string): void;
}) {
  const summary = billPlanning(data.events, date, data.preferences.locale);
  const sections = [
    ["Overdue", summary.overdue],
    ["Due in the next 7 days", summary.dueSoon],
    ["Due later this month", summary.laterThisMonth],
    ["Paid this month", summary.paidThisMonth],
  ] as const;
  return (
    <Panel>
      <SectionHeader
        eyebrow="Bill planning"
        title="See obligations before they become urgent"
        detail="Nexus tracks due and paid state; it never claims to process a payment."
        action={
          <Button variant="primary" onClick={() => onAdd(date)}>
            Add bill
          </Button>
        }
      />
      <div className="bill-totals" aria-label="Upcoming unpaid totals">
        {summary.totals.length ? (
          summary.totals.map((total) => (
            <div key={total.currency}>
              <span>Visible unpaid · {total.currency}</span>
              <strong>{total.formatted}</strong>
            </div>
          ))
        ) : (
          <p className="surface-note">No visible unpaid amount.</p>
        )}
      </div>
      {sections.map(([label, bills]) => (
        <section key={label} aria-label={label}>
          <header className="planning-section-header">
            <h2>{label}</h2>
            <Badge
              tone={label === "Overdue" && bills.length ? "danger" : "neutral"}
            >
              {bills.length}
            </Badge>
          </header>
          {bills.length ? (
            <div className="planner-list">
              {bills.map((bill) => (
                <article key={bill.occurrenceKey}>
                  <Banknote aria-hidden="true" />
                  <div>
                    <strong>{bill.title}</strong>
                    <p>
                      {formatDate(bill.localDate)} ·{" "}
                      {bill.amount === null
                        ? "Amount not set"
                        : new Intl.NumberFormat(data.preferences.locale, {
                            style: "currency",
                            currency: bill.currency,
                          }).format(bill.amount)}
                    </p>
                    <small>
                      {bill.autopay ? "Autopay noted" : "Manual payment"} ·{" "}
                      {bill.paymentStatus ?? "Unresolved"}
                    </small>
                  </div>
                  <div className="item-actions">
                    <Button variant="tertiary" onClick={() => onOpen(bill)}>
                      Open
                    </Button>
                    <Button
                      variant="tertiary"
                      onClick={() =>
                        onPayment(
                          bill,
                          bill.paymentStatus === "paid" ? "unpaid" : "paid",
                        )
                      }
                    >
                      {bill.paymentStatus === "paid"
                        ? "Mark unpaid"
                        : "Mark paid"}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="surface-note">Nothing in this group.</p>
          )}
        </section>
      ))}
    </Panel>
  );
}

export function CalendarBriefDialog({
  mode,
  data,
  now,
  onClose,
  onOpen,
  onStatus,
}: {
  mode: "morning" | "evening" | null;
  data: CalendarPayload | null;
  now: Date;
  onClose(): void;
  onOpen(event: CalendarEvent): void;
  onStatus(event: CalendarEvent, status: EventStatus): void;
}) {
  const brief = data && mode ? calendarBrief(data, now, mode) : null;
  return (
    <Dialog
      open={Boolean(brief)}
      title={brief?.title ?? "Calendar Brief"}
      description="A deterministic summary from your Calendar records. No Atlas language or external intelligence."
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      {brief ? (
        <div className="calendar-brief">
          <p className="calendar-brief__summary">{brief.summary}</p>
          {brief.first ? (
            <button onClick={() => onOpen(brief.first!)}>
              <Clock3 aria-hidden="true" />
              <span>
                <small>First commitment</small>
                <strong>{briefEventTitle(brief.first)}</strong>
              </span>
            </button>
          ) : null}
          {brief.important ? (
            <button onClick={() => onOpen(brief.important!)}>
              <AlertTriangle aria-hidden="true" />
              <span>
                <small>Most important</small>
                <strong>{briefEventTitle(brief.important)}</strong>
              </span>
            </button>
          ) : null}
          {brief.bills.length ? (
            <p>{brief.bills.length} bill reminder(s) approaching.</p>
          ) : null}
          {brief.birthdays.length ? (
            <p>{brief.birthdays.length} birthday(s) approaching.</p>
          ) : null}
          {brief.warnings.map((warning) => (
            <p className="inline-warning" key={warning.id}>
              {warning.first.sensitive || warning.second.sensitive
                ? "A sensitive event creates a schedule warning."
                : warning.message}
            </p>
          ))}
          {brief.unresolved.length ? (
            <section aria-label="Unresolved commitments">
              <h3>Needs a decision</h3>
              {brief.unresolved.slice(0, 5).map((event) => (
                <div className="brief-unresolved" key={event.occurrenceKey}>
                  <button onClick={() => onOpen(event)}>
                    {briefEventTitle(event)}
                  </button>
                  <Button
                    variant="tertiary"
                    onClick={() => onStatus(event, "completed")}
                  >
                    Complete
                  </Button>
                  <Button
                    variant="tertiary"
                    onClick={() => onStatus(event, "dismissed")}
                  >
                    Dismiss
                  </Button>
                </div>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  );
}

export type RescueDecision = {
  event: CalendarEvent;
  action: "now" | "later" | "tomorrow" | "complete" | "dismiss";
};

export function RescueDialog({
  open,
  data,
  now,
  onClose,
  onApply,
}: {
  open: boolean;
  data: CalendarPayload | null;
  now: Date;
  onClose(): void;
  onApply(decisions: RescueDecision[]): void | Promise<void>;
}) {
  const candidates = useMemo(
    () => (data ? rescueCandidates(data.events, now) : []),
    [data, now],
  );
  const [decisions, setDecisions] = useState<
    Record<string, RescueDecision["action"]>
  >({});
  const [saving, setSaving] = useState(false);
  const plan = useMemo(
    () =>
      candidates
        .filter((event) => decisions[event.occurrenceKey])
        .map((event) => ({
          event,
          action: decisions[event.occurrenceKey],
        })),
    [candidates, decisions],
  );
  return (
    <Dialog
      open={open}
      title="Rebuild the rest of today"
      description="Choose one calm decision for each item. Nothing moves until you confirm the plan."
      onClose={onClose}
      footer={
        <>
          <Button variant="tertiary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!plan.length}
            onClick={async () => {
              setSaving(true);
              try {
                await onApply(plan);
                setDecisions({});
              } finally {
                setSaving(false);
              }
            }}
          >
            Apply repair plan
          </Button>
        </>
      }
    >
      <div className="rescue-flow">
        {candidates.length ? (
          candidates.map((event, index) => (
            <fieldset key={event.occurrenceKey}>
              <legend>
                {index + 1}. {event.title}
              </legend>
              <p>
                Originally {formatDate(event.localDate)} ·{" "}
                {formatTime(event.startAt, data?.preferences.hourCycle ?? "12")}
              </p>
              <div className="rescue-options">
                {(
                  [
                    ["now", "Do now"],
                    ["later", "Move later today"],
                    ["tomorrow", "Move to tomorrow"],
                    ["complete", "Complete"],
                    ["dismiss", "Dismiss"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name={`rescue-${event.occurrenceKey}`}
                      checked={decisions[event.occurrenceKey] === value}
                      onChange={() =>
                        setDecisions((current) => ({
                          ...current,
                          [event.occurrenceKey]: value,
                        }))
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))
        ) : (
          <EmptyState
            title="Nothing needs Rescue Mode"
            detail="There are no overdue actionable events in this view."
          />
        )}
        {plan.length ? (
          <section className="rescue-preview" aria-label="Repair plan preview">
            <h3>Preview</h3>
            {plan.map(({ event, action }) => (
              <p key={event.occurrenceKey}>
                <strong>{event.title}</strong> ·{" "}
                {action === "now"
                  ? "move to the next available moment"
                  : action === "later"
                    ? "move later today"
                    : action === "tomorrow"
                      ? "move to tomorrow"
                      : action}
              </p>
            ))}
          </section>
        ) : null}
      </div>
    </Dialog>
  );
}
