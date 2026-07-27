"use client";

import {
  AlertTriangle,
  BrainCircuit,
  Cable,
  CalendarSearch,
  Check,
  Clock3,
  ExternalLink,
  History,
  RefreshCw,
  ShieldCheck,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  calendarIntelligenceApi,
  type CalendarIntelligenceApi,
} from "../../lib/client/calendar-intelligence-api";
import type {
  AtlasAnswer,
  AvailabilitySlot,
  CalendarIntelligencePayload,
  CalendarOperation,
  CalendarProposal,
  SyncConflict,
} from "../../lib/calendar-intelligence/types";
import type { CalendarEventInput } from "../../lib/time/types";
import { addDays } from "../../lib/time/rules";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { EmptyState, ErrorState, SkeletonLines } from "../ui/Feedback";

type IntelligenceTab = "concierge" | "connected" | "privacy" | "history";

function formatDateTime(value: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function sourceName(data: CalendarIntelligencePayload, id: string | null) {
  return (
    data.sources.find((source) => source.id === id)?.displayName ??
    "Nexus Calendar"
  );
}

function operationEvent(operation: CalendarOperation) {
  return operation.type === "create-event" ? operation.event : operation.after;
}

const IMMEDIATE_EVENT_TYPES = new Set([
  "personal",
  "meeting",
  "workout",
  "reminder",
]);

export function CalendarIntelligenceDialog({
  open,
  date,
  onClose,
  onCalendarChanged,
  api = calendarIntelligenceApi,
}: {
  open: boolean;
  date: string;
  onClose(): void;
  onCalendarChanged(): void | Promise<void>;
  api?: CalendarIntelligenceApi;
}) {
  const [tab, setTab] = useState<IntelligenceTab>("concierge");
  const [data, setData] = useState<CalendarIntelligencePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [captureText, setCaptureText] = useState("");
  const [proposal, setProposal] = useState<CalendarProposal | null>(null);
  const [captureMeta, setCaptureMeta] = useState<{
    engine: "atlas" | "deterministic";
    inferredFields: string[];
    assumptions: string[];
    ambiguities: string[];
  } | null>(null);
  const [selectedOperations, setSelectedOperations] = useState<string[]>([]);
  const [askText, setAskText] = useState("");
  const [answer, setAnswer] = useState<AtlasAnswer | null>(null);
  const [duration, setDuration] = useState(60);
  const [availabilityEnd, setAvailabilityEnd] = useState(addDays(date, 7));
  const [period, setPeriod] = useState<
    "any" | "morning" | "afternoon" | "evening"
  >("any");
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [undoId, setUndoId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api.load());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Connected intelligence could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setAvailabilityEnd(addDays(date, 7));
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
    // api is an injectable test boundary with stable production identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "The Calendar action could not be completed.",
      );
    } finally {
      setBusy("");
    }
  };

  const writableSources = useMemo(
    () => data?.sources.filter((source) => source.access === "write") ?? [],
    [data],
  );

  const createPreview = async (event: FormEvent) => {
    event.preventDefault();
    if (!captureText.trim()) return;
    await run("capture", async () => {
      const result = await api.capture(captureText.trim());
      const operation = result.proposal.operations[0];
      const parsedEvent = operation ? operationEvent(operation) : null;
      const applyImmediately =
        data?.privacy.immediateCreateWithUndo === true &&
        result.proposal.operations.length === 1 &&
        operation?.type === "create-event" &&
        operation.destinationSourceId === "nexus" &&
        parsedEvent !== null &&
        IMMEDIATE_EVENT_TYPES.has(parsedEvent.eventType) &&
        result.preview.ambiguities.length === 0 &&
        result.preview.conflicts.length === 0;
      if (applyImmediately) {
        const applied = await api.applyProposal(result.proposal.id, [
          operation.id,
        ]);
        setProposal(null);
        setCaptureMeta(null);
        setUndoId(applied.auditId);
        setNotice(
          "The clear, low-risk Nexus event was created under your saved immediate-create permission.",
        );
        await onCalendarChanged();
        await reload();
        return;
      }
      setProposal(result.proposal);
      setSelectedOperations(result.proposal.operations.map((item) => item.id));
      setCaptureMeta({
        engine: result.preview.engine,
        inferredFields: result.preview.inferredFields,
        assumptions: result.preview.assumptions,
        ambiguities: result.preview.ambiguities,
      });
    });
  };

  const applyProposal = async (acknowledgeConflicts = false) => {
    if (!proposal) return;
    await run("apply", async () => {
      const result = await api.applyProposal(
        proposal.id,
        selectedOperations,
        acknowledgeConflicts,
      );
      setProposal(result.proposal);
      setUndoId(result.auditId);
      setNotice(
        selectedOperations.length
          ? "The reviewed Calendar changes were applied."
          : "No proposal changes were selected.",
      );
      await onCalendarChanged();
      await reload();
    });
  };

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    if (!askText.trim()) return;
    await run("ask", async () => setAnswer(await api.ask(askText.trim())));
  };

  const findTime = async (event: FormEvent) => {
    event.preventDefault();
    await run("availability", async () => {
      const result = await api.availability({
        durationMinutes: duration,
        startDate: date,
        endDate: availabilityEnd,
        preferredPeriod: period,
      });
      setSlots(result.slots);
    });
  };

  const chooseSlot = async (slot: AvailabilitySlot) => {
    const text = `Personal focus on ${slot.localDate} at ${slot.startTime} for ${duration} minutes`;
    setCaptureText(text);
    await run("capture", async () => {
      const result = await api.capture(text);
      setProposal(result.proposal);
      setSelectedOperations(result.proposal.operations.map((item) => item.id));
      setCaptureMeta({
        engine: result.preview.engine,
        inferredFields: result.preview.inferredFields,
        assumptions: result.preview.assumptions,
        ambiguities: result.preview.ambiguities,
      });
      setSlots([]);
    });
  };

  const planDay = async () => {
    await run("plan", async () => {
      const next = await api.plan(date);
      setProposal(next);
      setSelectedOperations(next.operations.map((item) => item.id));
      setCaptureMeta(null);
    });
  };

  const undo = async () => {
    if (!undoId) return;
    await run("undo", async () => {
      await api.undoAudit(undoId);
      setUndoId(null);
      setNotice("The prior Calendar state was restored.");
      await onCalendarChanged();
      await reload();
    });
  };

  return (
    <Dialog
      open={open}
      title="Calendar intelligence"
      description="Connected calendars, grounded answers, and reviewed changes. Nothing changes without your approval."
      onClose={onClose}
    >
      <div className="intelligence-shell">
        <div
          className="intelligence-tabs"
          role="tablist"
          aria-label="Calendar intelligence sections"
        >
          {(
            [
              ["concierge", "Concierge", BrainCircuit],
              ["connected", "Connected", Cable],
              ["privacy", "Privacy", ShieldCheck],
              ["history", "History", History],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              className={tab === value ? "is-active" : ""}
              onClick={() => setTab(value)}
            >
              <Icon aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="intelligence-message is-error" role="alert">
            <AlertTriangle aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}
        {notice ? (
          <div className="intelligence-message" role="status">
            <Check aria-hidden="true" />
            <span>{notice}</span>
            {undoId ? (
              <Button
                variant="tertiary"
                icon={<Undo2 aria-hidden="true" />}
                loading={busy === "undo"}
                onClick={() => void undo()}
              >
                Undo
              </Button>
            ) : null}
          </div>
        ) : null}

        {loading && !data ? (
          <SkeletonLines rows={8} />
        ) : error && !data ? (
          <ErrorState
            title="Connected intelligence is unavailable"
            detail="Core Calendar views and local records remain available."
            onRetry={() => void reload()}
          />
        ) : data && tab === "concierge" ? (
          <Concierge
            data={data}
            date={date}
            captureText={captureText}
            onCaptureText={setCaptureText}
            onCapture={createPreview}
            proposal={proposal}
            captureMeta={captureMeta}
            selectedOperations={selectedOperations}
            onSelectedOperations={setSelectedOperations}
            writableSources={writableSources}
            onProposal={setProposal}
            onApply={applyProposal}
            onReject={async () => {
              if (!proposal) return;
              await run("reject", async () => {
                await api.rejectProposal(proposal.id);
                setProposal(null);
                setCaptureMeta(null);
                setNotice(
                  "The proposal was discarded. No Calendar data changed.",
                );
              });
            }}
            busy={busy}
            askText={askText}
            onAskText={setAskText}
            onAsk={ask}
            answer={answer}
            duration={duration}
            onDuration={setDuration}
            availabilityEnd={availabilityEnd}
            onAvailabilityEnd={setAvailabilityEnd}
            period={period}
            onPeriod={setPeriod}
            onFindTime={findTime}
            slots={slots}
            onChooseSlot={chooseSlot}
            onPlanDay={planDay}
            api={api}
          />
        ) : data && tab === "connected" ? (
          <ConnectedCalendars
            data={data}
            busy={busy}
            run={run}
            reload={reload}
            onCalendarChanged={onCalendarChanged}
            api={api}
          />
        ) : data && tab === "privacy" ? (
          <PrivacyAndInsights
            key={data.privacy.updatedAt}
            data={data}
            busy={busy}
            run={run}
            reload={reload}
            api={api}
          />
        ) : data ? (
          <AuditHistory
            data={data}
            busy={busy}
            run={run}
            reload={reload}
            onCalendarChanged={onCalendarChanged}
            api={api}
          />
        ) : null}
      </div>
    </Dialog>
  );
}

function Concierge({
  data,
  date,
  captureText,
  onCaptureText,
  onCapture,
  proposal,
  captureMeta,
  selectedOperations,
  onSelectedOperations,
  writableSources,
  onProposal,
  onApply,
  onReject,
  busy,
  askText,
  onAskText,
  onAsk,
  answer,
  duration,
  onDuration,
  availabilityEnd,
  onAvailabilityEnd,
  period,
  onPeriod,
  onFindTime,
  slots,
  onChooseSlot,
  onPlanDay,
  api,
}: {
  data: CalendarIntelligencePayload;
  date: string;
  captureText: string;
  onCaptureText(value: string): void;
  onCapture(event: FormEvent): void;
  proposal: CalendarProposal | null;
  captureMeta: {
    engine: "atlas" | "deterministic";
    inferredFields: string[];
    assumptions: string[];
    ambiguities: string[];
  } | null;
  selectedOperations: string[];
  onSelectedOperations(value: string[]): void;
  writableSources: CalendarIntelligencePayload["sources"];
  onProposal(value: CalendarProposal | null): void;
  onApply(acknowledgeConflicts?: boolean): void;
  onReject(): void;
  busy: string;
  askText: string;
  onAskText(value: string): void;
  onAsk(event: FormEvent): void;
  answer: AtlasAnswer | null;
  duration: number;
  onDuration(value: number): void;
  availabilityEnd: string;
  onAvailabilityEnd(value: string): void;
  period: "any" | "morning" | "afternoon" | "evening";
  onPeriod(value: "any" | "morning" | "afternoon" | "evening"): void;
  onFindTime(event: FormEvent): void;
  slots: AvailabilitySlot[];
  onChooseSlot(slot: AvailabilitySlot): void;
  onPlanDay(): void;
  api: CalendarIntelligenceApi;
}) {
  return (
    <div className="intelligence-stack" role="tabpanel">
      <section className="intelligence-status">
        <div>
          <span className="intelligence-status__icon">
            <BrainCircuit aria-hidden="true" />
          </span>
          <div>
            <strong>
              {data.capabilities.atlas.configured
                ? "Atlas model connected"
                : "Deterministic Calendar intelligence"}
            </strong>
            <p>
              {data.capabilities.atlas.configured
                ? `${data.capabilities.atlas.model} · typed output · approval required`
                : "Capture, answers, availability, and planning remain grounded without model-generated language."}
            </p>
          </div>
        </div>
        <Badge
          tone={data.capabilities.atlas.configured ? "success" : "neutral"}
        >
          {data.capabilities.atlas.configured ? "Available" : "Fallback active"}
        </Badge>
      </section>

      <section className="intelligence-card">
        <header>
          <div>
            <p className="eyebrow">Intelligent Quick Capture</p>
            <h3>Tell Calendar what needs to happen</h3>
          </div>
          <Badge tone="gold">Preview first</Badge>
        </header>
        <form className="intelligence-capture" onSubmit={onCapture}>
          <label>
            Calendar request
            <textarea
              value={captureText}
              maxLength={1_000}
              rows={3}
              placeholder="Dentist next Tuesday at 2 for an hour"
              onChange={(event) => onCaptureText(event.target.value)}
            />
          </label>
          <Button
            type="submit"
            variant="primary"
            loading={busy === "capture"}
            icon={<CalendarSearch aria-hidden="true" />}
          >
            Build preview
          </Button>
        </form>
        {proposal ? (
          <ProposalReview
            key={`${proposal.id}:${proposal.summary}`}
            proposal={proposal}
            data={data}
            captureMeta={captureMeta}
            selectedOperations={selectedOperations}
            onSelectedOperations={onSelectedOperations}
            writableSources={writableSources}
            onProposal={onProposal}
            onApply={onApply}
            onReject={onReject}
            busy={busy}
            api={api}
          />
        ) : null}
      </section>

      <div className="intelligence-grid">
        <section className="intelligence-card">
          <header>
            <div>
              <p className="eyebrow">Ask Atlas</p>
              <h3>Grounded calendar answers</h3>
            </div>
          </header>
          <form className="intelligence-question" onSubmit={onAsk}>
            <label>
              Question
              <input
                value={askText}
                maxLength={500}
                placeholder="What do I have tomorrow?"
                onChange={(event) => onAskText(event.target.value)}
              />
            </label>
            <Button type="submit" loading={busy === "ask"}>
              Ask
            </Button>
          </form>
          {answer ? (
            <div className="atlas-answer" aria-live="polite">
              <div>
                <Badge tone={answer.engine === "atlas" ? "gold" : "neutral"}>
                  {answer.engine === "atlas"
                    ? "Atlas answer"
                    : "Deterministic answer"}
                </Badge>
                <small>{answer.interpretation}</small>
              </div>
              <p>{answer.answer}</p>
              {answer.facts.length ? (
                <ul>
                  {answer.facts.map((fact) => (
                    <li key={fact.occurrenceKey}>
                      <a href={`/calendar?view=day&date=${fact.localDate}`}>
                        {fact.label} · {fact.localDate}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="intelligence-card">
          <header>
            <div>
              <p className="eyebrow">Find Time</p>
              <h3>Deterministic availability</h3>
            </div>
          </header>
          <form className="availability-form" onSubmit={onFindTime}>
            <label>
              Minutes
              <input
                type="number"
                min={15}
                max={480}
                step={15}
                value={duration}
                onChange={(event) => onDuration(Number(event.target.value))}
              />
            </label>
            <label>
              Through
              <input
                type="date"
                min={date}
                max={addDays(date, 31)}
                value={availabilityEnd}
                onChange={(event) => onAvailabilityEnd(event.target.value)}
              />
            </label>
            <label>
              Preferred time
              <select
                value={period}
                onChange={(event) =>
                  onPeriod(
                    event.target.value as
                      "any" | "morning" | "afternoon" | "evening",
                  )
                }
              >
                <option value="any">Any time</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
              </select>
            </label>
            <Button
              type="submit"
              loading={busy === "availability"}
              icon={<Clock3 aria-hidden="true" />}
            >
              Find open blocks
            </Button>
          </form>
          {slots.length ? (
            <div className="availability-results">
              {slots.map((slot) => (
                <article key={slot.startAt}>
                  <div>
                    <strong>
                      {slot.localDate} · {slot.startTime}–{slot.endTime}
                    </strong>
                    <p>{slot.reason}</p>
                  </div>
                  <Button variant="tertiary" onClick={() => onChooseSlot(slot)}>
                    Build event preview
                  </Button>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <section className="plan-day-callout">
        <div>
          <p className="eyebrow">Plan My Day</p>
          <h3>Place unresolved flexible items into real open time</h3>
          <p>
            Meetings, medical events, bills, birthdays, and provider events stay
            fixed. Every proposed move remains individually selectable.
          </p>
        </div>
        <Button
          loading={busy === "plan"}
          onClick={onPlanDay}
          icon={<BrainCircuit aria-hidden="true" />}
        >
          Build plan for {date}
        </Button>
      </section>
    </div>
  );
}

function ProposalReview({
  proposal,
  data,
  captureMeta,
  selectedOperations,
  onSelectedOperations,
  writableSources,
  onProposal,
  onApply,
  onReject,
  busy,
  api,
}: {
  proposal: CalendarProposal;
  data: CalendarIntelligencePayload;
  captureMeta: {
    engine: "atlas" | "deterministic";
    inferredFields: string[];
    assumptions: string[];
    ambiguities: string[];
  } | null;
  selectedOperations: string[];
  onSelectedOperations(value: string[]): void;
  writableSources: CalendarIntelligencePayload["sources"];
  onProposal(value: CalendarProposal): void;
  onApply(acknowledgeConflicts?: boolean): void;
  onReject(): void;
  busy: string;
  api: CalendarIntelligenceApi;
}) {
  const first = proposal.operations[0];
  const initial = first ? operationEvent(first) : null;
  const includesProviderCreate = proposal.operations.some(
    (operation) =>
      operation.type === "create-event" &&
      operation.destinationSourceId !== null &&
      operation.destinationSourceId !== "nexus",
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CalendarEventInput | null>(initial);
  const [destination, setDestination] = useState(
    first?.type === "create-event"
      ? (first.destinationSourceId ?? "nexus")
      : "nexus",
  );
  const [editError, setEditError] = useState("");

  const toggle = (id: string) => {
    onSelectedOperations(
      selectedOperations.includes(id)
        ? selectedOperations.filter((value) => value !== id)
        : [...selectedOperations, id],
    );
  };

  const saveEdit = async () => {
    if (!first || !draft) return;
    setEditError("");
    try {
      const result = await api.editProposal(
        proposal.id,
        first.id,
        draft,
        first.type === "create-event" ? destination : undefined,
      );
      onProposal(result.proposal);
      setEditing(false);
    } catch (error) {
      setEditError(
        error instanceof Error
          ? error.message
          : "The preview could not be saved.",
      );
    }
  };

  return (
    <div className="proposal-review" aria-label="Proposal review">
      <div className="proposal-review__heading">
        <div>
          <Badge tone="warning">Needs confirmation</Badge>
          {captureMeta ? (
            <Badge tone={captureMeta.engine === "atlas" ? "gold" : "neutral"}>
              {captureMeta.engine === "atlas"
                ? "Atlas interpretation"
                : "Deterministic interpretation"}
            </Badge>
          ) : null}
        </div>
        <h4>{proposal.summary}</h4>
      </div>

      {captureMeta?.ambiguities.length ? (
        <div className="proposal-warning">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>Review these interpretations</strong>
            <ul>
              {captureMeta.ambiguities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="proposal-operations">
        {proposal.operations.map((operation) => {
          const event = operationEvent(operation);
          return (
            <label key={operation.id}>
              <input
                type="checkbox"
                checked={selectedOperations.includes(operation.id)}
                onChange={() => toggle(operation.id)}
              />
              <span>
                <strong>
                  {operation.type === "move-event" ? "Move" : "Create"} ·{" "}
                  {event.title}
                </strong>
                <small>
                  {event.localDate}
                  {event.startTime
                    ? ` · ${event.startTime}–${event.endTime}`
                    : " · All day"}
                  {" · "}
                  {operation.type === "create-event"
                    ? sourceName(data, operation.destinationSourceId)
                    : "Nexus Calendar"}
                </small>
                <small>{operation.reason}</small>
              </span>
            </label>
          );
        })}
      </div>

      {proposal.assumptions.length ? (
        <details>
          <summary>Assumptions and safeguards</summary>
          <ul>
            {proposal.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {editing && draft ? (
        <div className="proposal-editor">
          <div className="proposal-editor__grid">
            <label>
              Title
              <input
                value={draft.title}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={draft.localDate}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    localDate: event.target.value,
                    endLocalDate: event.target.value,
                  })
                }
              />
            </label>
            {!draft.allDay ? (
              <>
                <label>
                  Start time
                  <input
                    type="time"
                    value={draft.startTime ?? ""}
                    onChange={(event) =>
                      setDraft({ ...draft, startTime: event.target.value })
                    }
                  />
                </label>
                <label>
                  End time
                  <input
                    type="time"
                    value={draft.endTime ?? ""}
                    onChange={(event) =>
                      setDraft({ ...draft, endTime: event.target.value })
                    }
                  />
                </label>
              </>
            ) : null}
            <label>
              Location
              <input
                value={draft.location}
                onChange={(event) =>
                  setDraft({ ...draft, location: event.target.value })
                }
              />
            </label>
            {first?.type === "create-event" ? (
              <label>
                Destination calendar
                <select
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                >
                  {writableSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.displayName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          {editError ? <p className="form-error">{editError}</p> : null}
          <div className="item-actions">
            <Button variant="tertiary" onClick={() => setEditing(false)}>
              Cancel edit
            </Button>
            <Button onClick={() => void saveEdit()}>Save preview</Button>
          </div>
        </div>
      ) : null}

      {proposal.conflicts.length ? (
        <div className="proposal-warning">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>
              {proposal.conflicts.length} existing commitment
              {proposal.conflicts.length === 1 ? "" : "s"} overlap
            </strong>
            <p>Approval will revalidate the Calendar before applying.</p>
          </div>
        </div>
      ) : null}
      {includesProviderCreate ? (
        <p className="surface-note">
          Undo for a connected-calendar creation requires that provider to
          remain available. Nexus will not report undo success or remove the
          local record if the provider deletion fails.
        </p>
      ) : null}

      <div className="proposal-review__actions">
        {first ? (
          <Button
            variant="tertiary"
            onClick={() => setEditing((value) => !value)}
          >
            Edit fields
          </Button>
        ) : null}
        <Button
          variant="tertiary"
          onClick={onReject}
          loading={busy === "reject"}
        >
          Discard
        </Button>
        <Button
          variant="primary"
          disabled={!selectedOperations.length}
          loading={busy === "apply"}
          onClick={() => onApply(false)}
        >
          Apply {selectedOperations.length || ""} reviewed change
          {selectedOperations.length === 1 ? "" : "s"}
        </Button>
      </div>
    </div>
  );
}

function ConnectedCalendars({
  data,
  busy,
  run,
  reload,
  onCalendarChanged,
  api,
}: {
  data: CalendarIntelligencePayload;
  busy: string;
  run(key: string, action: () => Promise<void>): Promise<void>;
  reload(): Promise<void>;
  onCalendarChanged(): void | Promise<void>;
  api: CalendarIntelligenceApi;
}) {
  return (
    <div className="intelligence-stack" role="tabpanel">
      <section className="intelligence-card">
        <header>
          <div>
            <p className="eyebrow">Connected Calendars</p>
            <h3>Provider accounts and sync health</h3>
          </div>
          <Badge
            tone={
              data.connections.some((item) => item.status === "attention")
                ? "warning"
                : data.connections.length
                  ? "success"
                  : "neutral"
            }
          >
            {data.connections.some((item) => item.status === "attention")
              ? "Needs attention"
              : data.connections.length
                ? "Healthy"
                : "Local only"}
          </Badge>
        </header>
        {!data.connections.length ? (
          <div className="provider-empty">
            <span className="provider-mark">G</span>
            <div>
              <strong>Google Calendar</strong>
              <p>
                Read selected calendars, write only to calendars you choose, and
                exclude any source from availability or Atlas.
              </p>
              {data.capabilities.google.configured ? (
                <Link
                  className="button button--primary"
                  href="/api/calendar/google/connect"
                >
                  Connect Google Calendar
                  <ExternalLink aria-hidden="true" />
                </Link>
              ) : (
                <div className="provider-not-configured">
                  <Badge tone="neutral">Not configured</Badge>
                  <small>
                    A server administrator must configure Google OAuth before a
                    connection can be offered.
                  </small>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="connection-list">
            {data.connections.map((connection) => (
              <article key={connection.id} className="connection-card">
                <div className="connection-card__top">
                  <span className="provider-mark">G</span>
                  <div>
                    <strong>{connection.accountEmail}</strong>
                    <p>
                      Last confirmed sync ·{" "}
                      {formatDateTime(connection.lastSyncedAt)}
                    </p>
                  </div>
                  <Badge
                    tone={
                      connection.status === "healthy"
                        ? "success"
                        : connection.status === "attention"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {connection.status}
                  </Badge>
                </div>
                {connection.lastError ? (
                  <div className="connection-error" role="status">
                    <AlertTriangle aria-hidden="true" />
                    {connection.lastError}
                  </div>
                ) : null}
                <div className="item-actions">
                  {connection.status === "attention" &&
                  data.capabilities.google.configured ? (
                    <Link
                      className="button button--tertiary"
                      href="/api/calendar/google/connect"
                    >
                      Reconnect
                    </Link>
                  ) : null}
                  <Button
                    variant="tertiary"
                    icon={<RefreshCw aria-hidden="true" />}
                    loading={busy === `sync:${connection.id}`}
                    onClick={() =>
                      void run(`sync:${connection.id}`, async () => {
                        await api.sync(connection.id);
                        await reload();
                        await onCalendarChanged();
                      })
                    }
                  >
                    Sync now
                  </Button>
                </div>
                <details className="disconnect-control">
                  <summary>Disconnect options</summary>
                  <p>
                    Disconnecting never deletes events from Google. Choose what
                    happens only to the local provider cache.
                  </p>
                  <div className="item-actions">
                    <Button
                      variant="tertiary"
                      loading={busy === `disconnect-snapshot:${connection.id}`}
                      onClick={() =>
                        void run(
                          `disconnect-snapshot:${connection.id}`,
                          async () => {
                            await api.disconnect(connection.id, "snapshot");
                            await reload();
                            await onCalendarChanged();
                          },
                        )
                      }
                    >
                      Keep read-only snapshot
                    </Button>
                    <Button
                      variant="destructive"
                      loading={busy === `disconnect-remove:${connection.id}`}
                      onClick={() =>
                        void run(
                          `disconnect-remove:${connection.id}`,
                          async () => {
                            await api.disconnect(connection.id, "remove");
                            await reload();
                            await onCalendarChanged();
                          },
                        )
                      }
                    >
                      Remove local cache
                    </Button>
                  </div>
                </details>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="intelligence-card">
        <header>
          <div>
            <p className="eyebrow">Calendar Sources</p>
            <h3>Visibility, availability, and Atlas access</h3>
          </div>
        </header>
        <div className="source-list">
          {data.sources.map((source) => (
            <article key={source.id}>
              <div>
                <span className={`source-dot source-dot--${source.colorKey}`} />
                <div>
                  <strong>{source.displayName}</strong>
                  <small>
                    {source.provider === "nexus" ? "Nexus" : "Google"} ·{" "}
                    {source.access === "write" ? "Read and write" : "Read only"}
                  </small>
                </div>
              </div>
              <div className="source-controls">
                <label>
                  <input
                    type="checkbox"
                    checked={source.visible}
                    disabled={source.provider === "nexus"}
                    onChange={(event) =>
                      void run(`source:${source.id}:visible`, async () => {
                        await api.updateSource(source.id, {
                          visible: event.target.checked,
                        });
                        await reload();
                        await onCalendarChanged();
                      })
                    }
                  />
                  Visible
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={source.includeInAvailability}
                    onChange={(event) =>
                      void run(`source:${source.id}:availability`, async () => {
                        await api.updateSource(source.id, {
                          includeInAvailability: event.target.checked,
                        });
                        await reload();
                      })
                    }
                  />
                  Availability
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={source.includeInAtlas}
                    onChange={(event) =>
                      void run(`source:${source.id}:atlas`, async () => {
                        await api.updateSource(source.id, {
                          includeInAtlas: event.target.checked,
                        });
                        await reload();
                      })
                    }
                  />
                  Atlas
                </label>
                {source.access === "write" ? (
                  <label>
                    <input
                      type="radio"
                      name="default-calendar"
                      checked={source.isDefault}
                      onChange={() =>
                        void run(`source:${source.id}:default`, async () => {
                          await api.updateSource(source.id, {
                            isDefault: true,
                          });
                          await reload();
                        })
                      }
                    />
                    Default
                  </label>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      {data.conflicts.length ? (
        <section className="intelligence-card">
          <header>
            <div>
              <p className="eyebrow">Source Conflicts</p>
              <h3>Review before either version is overwritten</h3>
            </div>
            <Badge tone="warning">{data.conflicts.length} open</Badge>
          </header>
          <div className="conflict-list">
            {data.conflicts.map((conflict) => (
              <ConflictResolver
                key={conflict.id}
                conflict={conflict}
                busy={busy}
                onResolve={(resolution, event) =>
                  run(`conflict:${conflict.id}`, async () => {
                    await api.resolveConflict(conflict.id, resolution, event);
                    await reload();
                    await onCalendarChanged();
                  })
                }
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ConflictResolver({
  conflict,
  busy,
  onResolve,
}: {
  conflict: SyncConflict;
  busy: string;
  onResolve(
    resolution: "nexus" | "provider" | "merged",
    event?: CalendarEventInput,
  ): Promise<void>;
}) {
  const [mergeOpen, setMergeOpen] = useState(false);
  const [merged, setMerged] = useState<CalendarEventInput>({
    ...conflict.providerVersion,
    ...conflict.localVersion,
  } as CalendarEventInput);
  return (
    <article>
      <div>
        <strong>{conflict.localVersion.title ?? "Calendar event"}</strong>
        <p>Different fields: {conflict.differingFields.join(", ")}</p>
      </div>
      <div className="conflict-comparison">
        <div>
          <Badge tone="gold">Nexus</Badge>
          <strong>{conflict.localVersion.title ?? "Untitled"}</strong>
          <small>
            {conflict.localVersion.localDate} ·{" "}
            {conflict.localVersion.startTime ?? "All day"}
          </small>
        </div>
        <div>
          <Badge tone="info">Provider</Badge>
          <strong>{conflict.providerVersion.title ?? "Untitled"}</strong>
          <small>
            {conflict.providerVersion.localDate} ·{" "}
            {conflict.providerVersion.startTime ?? "All day"}
          </small>
        </div>
      </div>
      {mergeOpen ? (
        <div className="proposal-editor__grid">
          <label>
            Merged title
            <input
              value={merged.title ?? ""}
              onChange={(event) =>
                setMerged({ ...merged, title: event.target.value })
              }
            />
          </label>
          <label>
            Merged date
            <input
              type="date"
              value={merged.localDate ?? ""}
              onChange={(event) =>
                setMerged({
                  ...merged,
                  localDate: event.target.value,
                  endLocalDate: event.target.value,
                })
              }
            />
          </label>
          <label>
            Merged location
            <input
              value={merged.location ?? ""}
              onChange={(event) =>
                setMerged({ ...merged, location: event.target.value })
              }
            />
          </label>
        </div>
      ) : null}
      <div className="item-actions">
        <Button
          variant="tertiary"
          loading={busy === `conflict:${conflict.id}`}
          onClick={() => void onResolve("nexus")}
        >
          Keep Nexus
        </Button>
        <Button
          variant="tertiary"
          loading={busy === `conflict:${conflict.id}`}
          onClick={() => void onResolve("provider")}
        >
          Keep provider
        </Button>
        {mergeOpen ? (
          <Button
            loading={busy === `conflict:${conflict.id}`}
            onClick={() => void onResolve("merged", merged)}
          >
            Apply reviewed merge
          </Button>
        ) : (
          <Button onClick={() => setMergeOpen(true)}>Review and merge</Button>
        )}
      </div>
    </article>
  );
}

function PrivacyAndInsights({
  data,
  busy,
  run,
  reload,
  api,
}: {
  data: CalendarIntelligencePayload;
  busy: string;
  run(key: string, action: () => Promise<void>): Promise<void>;
  reload(): Promise<void>;
  api: CalendarIntelligenceApi;
}) {
  const [privacy, setPrivacy] = useState(data.privacy);
  return (
    <div className="intelligence-stack" role="tabpanel">
      <section className="intelligence-card">
        <header>
          <div>
            <p className="eyebrow">Privacy and Intelligence</p>
            <h3>
              Control which context can leave deterministic Calendar logic
            </h3>
          </div>
        </header>
        <div className="privacy-controls">
          <label>
            <span>
              <strong>Sensitive events in Atlas</strong>
              <small>
                Off by default. Sensitive events remain visible in your private
                Calendar but are excluded from model context.
              </small>
            </span>
            <input
              type="checkbox"
              checked={privacy.sensitiveEventsInAtlas}
              onChange={(event) =>
                setPrivacy({
                  ...privacy,
                  sensitiveEventsInAtlas: event.target.checked,
                })
              }
            />
          </label>
          <label>
            <span>
              <strong>Pattern insights</strong>
              <small>
                Use deterministic counts and evidence. No diagnosis or score.
              </small>
            </span>
            <input
              type="checkbox"
              checked={privacy.patternInsights}
              onChange={(event) =>
                setPrivacy({
                  ...privacy,
                  patternInsights: event.target.checked,
                })
              }
            />
          </label>
          <label>
            <span>
              <strong>Semantic query interpretation</strong>
              <small>
                Exact structured search remains available when Atlas is offline.
              </small>
            </span>
            <input
              type="checkbox"
              checked={privacy.semanticSearch}
              onChange={(event) =>
                setPrivacy({ ...privacy, semanticSearch: event.target.checked })
              }
            />
          </label>
          <label>
            <span>
              <strong>Create immediately with undo</strong>
              <small>
                Only a clear, conflict-free, single Nexus personal, meeting,
                workout, or reminder can skip preview. Everything else still
                requires review and every immediate creation has undo.
              </small>
            </span>
            <input
              type="checkbox"
              checked={privacy.immediateCreateWithUndo}
              onChange={(event) =>
                setPrivacy({
                  ...privacy,
                  immediateCreateWithUndo: event.target.checked,
                })
              }
            />
          </label>
          <label>
            <span>
              <strong>Default disconnect retention</strong>
              <small>
                Disconnect confirmation always states the selected behavior.
              </small>
            </span>
            <select
              value={privacy.disconnectedDataRetention}
              onChange={(event) =>
                setPrivacy({
                  ...privacy,
                  disconnectedDataRetention: event.target.value as
                    "remove" | "snapshot",
                })
              }
            >
              <option value="remove">Remove cached provider data</option>
              <option value="snapshot">Keep read-only snapshot</option>
            </select>
          </label>
        </div>
        <Button
          variant="primary"
          loading={busy === "privacy"}
          onClick={() =>
            void run("privacy", async () => {
              await api.updatePrivacy({
                sensitiveEventsInAtlas: privacy.sensitiveEventsInAtlas,
                patternInsights: privacy.patternInsights,
                semanticSearch: privacy.semanticSearch,
                immediateCreateWithUndo: privacy.immediateCreateWithUndo,
                disconnectedDataRetention: privacy.disconnectedDataRetention,
              });
              await reload();
            })
          }
        >
          Save privacy settings
        </Button>
      </section>

      <section className="intelligence-card">
        <header>
          <div>
            <p className="eyebrow">Pattern Insights</p>
            <h3>Evidence before suggestion</h3>
          </div>
        </header>
        {data.insights.length ? (
          <div className="insight-list">
            {data.insights.map((insight) => (
              <article key={insight.id}>
                <strong>{insight.observation}</strong>
                <p>{insight.evidence}</p>
                <small>{insight.dateRange}</small>
                <p className="surface-note">{insight.suggestion}</p>
                <div className="item-actions">
                  <Button
                    variant="tertiary"
                    onClick={() =>
                      void run(`insight:${insight.id}`, async () => {
                        await api.updateInsight(insight.id, "dismiss");
                        await reload();
                      })
                    }
                  >
                    Dismiss
                  </Button>
                  <Button
                    variant="tertiary"
                    onClick={() =>
                      void run(`insight:${insight.id}`, async () => {
                        await api.updateInsight(insight.id, "mute");
                        await reload();
                      })
                    }
                  >
                    Mute this type
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No evidence-backed insight yet"
            detail="Calendar waits for a meaningful sample instead of guessing from isolated behavior."
          />
        )}
      </section>
    </div>
  );
}

function AuditHistory({
  data,
  busy,
  run,
  reload,
  onCalendarChanged,
  api,
}: {
  data: CalendarIntelligencePayload;
  busy: string;
  run(key: string, action: () => Promise<void>): Promise<void>;
  reload(): Promise<void>;
  onCalendarChanged(): void | Promise<void>;
  api: CalendarIntelligenceApi;
}) {
  const [renderedAt] = useState(() => Date.now());
  return (
    <section className="intelligence-card" role="tabpanel">
      <header>
        <div>
          <p className="eyebrow">Audit and Undo</p>
          <h3>Connected and Atlas-driven changes</h3>
        </div>
      </header>
      {data.audit.length ? (
        <ol className="audit-list">
          {data.audit.map((entry) => {
            const undoActive =
              entry.undoAvailable &&
              Date.parse(entry.createdAt) > renderedAt - 10 * 60_000;
            return (
              <li key={entry.id}>
                <span className="audit-list__marker" aria-hidden="true" />
                <div>
                  <strong>{entry.summary}</strong>
                  <small>
                    {entry.actor} · {formatDateTime(entry.createdAt)}
                  </small>
                  <div>
                    <Badge
                      tone={
                        entry.providerResult === "confirmed"
                          ? "success"
                          : entry.providerResult === "pending"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {entry.providerResult ?? entry.source}
                    </Badge>
                    {undoActive ? (
                      <Button
                        variant="tertiary"
                        icon={<Undo2 aria-hidden="true" />}
                        loading={busy === `undo:${entry.id}`}
                        onClick={() =>
                          void run(`undo:${entry.id}`, async () => {
                            await api.undoAudit(entry.id);
                            await reload();
                            await onCalendarChanged();
                          })
                        }
                      >
                        Undo
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState
          title="No connected changes yet"
          detail="Provider connections, conflict resolutions, and approved Atlas proposals will appear here."
        />
      )}
    </section>
  );
}
