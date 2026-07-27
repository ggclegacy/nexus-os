import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { expect, it, vi } from "vitest";
import { CalendarIntelligenceDialog } from "../components/calendar/CalendarIntelligence";
import { CalendarApp } from "../components/calendar/CalendarApp";
import type {
  CalendarIntelligencePayload,
  CalendarProposal,
  CapturePreview,
} from "../lib/calendar-intelligence/types";
import type { CalendarIntelligenceApi } from "../lib/client/calendar-intelligence-api";
import type { CalendarEventInput } from "../lib/time/types";
import { FakeTimeApi } from "./fixtures";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/calendar",
}));

const event: CalendarEventInput = {
  title: "Dentist",
  eventType: "medical",
  notes: "",
  location: "",
  provider: "",
  meetingUrl: "",
  amount: null,
  currency: "USD",
  paymentStatus: null,
  priority: "standard",
  status: "scheduled",
  allDay: false,
  localDate: "2026-07-28",
  endLocalDate: "2026-07-28",
  startTime: "14:00",
  endTime: "15:00",
  timeZone: "America/Chicago",
  recurrence: null,
  reminderOffsets: [120, 1_440],
  sensitive: true,
};

const proposal: CalendarProposal = {
  id: "proposal-1",
  userRequest: "Dentist next Tuesday at 2 for an hour",
  summary: "Create Dentist on 2026-07-28",
  operations: [
    {
      id: "proposal-1:create",
      type: "create-event",
      event,
      destinationSourceId: "nexus",
      reason: "Structured from the reviewed capture request.",
    },
  ],
  assumptions: ["2 was interpreted as PM."],
  conflicts: [],
  status: "draft",
  expiresAt: "2026-07-26T18:30:00.000Z",
  createdAt: "2026-07-26T18:15:00.000Z",
};

const preview: CapturePreview = {
  id: proposal.id,
  request: proposal.userRequest,
  summary: proposal.summary,
  event,
  destinationSourceId: "nexus",
  inferredFields: ["title", "date", "start time", "end time"],
  assumptions: [],
  ambiguities: ["2 was interpreted as PM."],
  conflicts: [],
  engine: "deterministic",
  expiresAt: proposal.expiresAt,
};

function payload(): CalendarIntelligencePayload {
  return {
    capabilities: {
      google: {
        configured: false,
        reasonUnavailable: "Google OAuth is not configured.",
      },
      atlas: {
        configured: false,
        model: null,
        reasonUnavailable: "OPENAI_API_KEY is not configured on the server.",
      },
      reconciliation: "manual",
      weather: false,
      travelTime: false,
      attachments: false,
      connectedModules: [],
    },
    connections: [],
    sources: [
      {
        id: "nexus",
        connectionId: null,
        provider: "nexus",
        externalCalendarId: null,
        displayName: "Nexus Calendar",
        access: "write",
        visible: true,
        includeInAvailability: true,
        includeInAtlas: true,
        isDefault: true,
        syncStatus: "healthy",
        lastSyncedAt: null,
        colorKey: "green",
      },
    ],
    conflicts: [],
    privacy: {
      sensitiveEventsInAtlas: false,
      patternInsights: true,
      semanticSearch: true,
      immediateCreateWithUndo: false,
      disconnectedDataRetention: "remove",
      updatedAt: "2026-07-26T18:00:00.000Z",
    },
    audit: [],
    insights: [],
  };
}

function fakeApi() {
  const load = vi.fn(async () => payload());
  const capture = vi.fn(async () => ({ preview, proposal }));
  const applyProposal = vi.fn(async () => ({
    proposal: { ...proposal, status: "applied" as const },
    events: [],
    auditId: "audit-1",
    undoUntil: "2026-07-26T18:35:00.000Z",
  }));
  const api = {
    load,
    capture,
    applyProposal,
    updatePrivacy: vi.fn(),
    updateSource: vi.fn(),
    sync: vi.fn(),
    disconnect: vi.fn(),
    ask: vi.fn(),
    availability: vi.fn(),
    plan: vi.fn(),
    rejectProposal: vi.fn(),
    editProposal: vi.fn(),
    resolveConflict: vi.fn(),
    updateInsight: vi.fn(),
    undoAudit: vi.fn(),
  } as unknown as CalendarIntelligenceApi;
  return { api, load, capture, applyProposal };
}

it("previews a sensitive capture before applying it and exposes undo afterward", async () => {
  const user = userEvent.setup();
  const { api, capture, applyProposal } = fakeApi();
  const changed = vi.fn();
  const { container } = render(
    <CalendarIntelligenceDialog
      open
      date="2026-07-26"
      onClose={vi.fn()}
      onCalendarChanged={changed}
      api={api}
    />,
  );

  expect(
    await screen.findByText("Deterministic Calendar intelligence"),
  ).toBeVisible();
  await user.type(
    screen.getByLabelText("Calendar request"),
    "Dentist next Tuesday at 2 for an hour",
  );
  await user.click(screen.getByRole("button", { name: "Build preview" }));

  expect(capture).toHaveBeenCalledOnce();
  expect(applyProposal).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Proposal review")).toBeVisible();
  expect(screen.getAllByText("2 was interpreted as PM.")).toHaveLength(2);
  expect(await axe(container)).toHaveNoViolations();

  await user.click(
    screen.getByRole("button", { name: "Apply 1 reviewed change" }),
  );
  expect(applyProposal).toHaveBeenCalledWith(
    "proposal-1",
    ["proposal-1:create"],
    false,
  );
  expect(changed).toHaveBeenCalledOnce();
  expect(await screen.findByRole("button", { name: "Undo" })).toBeVisible();
});

it("does not offer a dead Google connection action when OAuth is unavailable", async () => {
  const { api } = fakeApi();
  render(
    <CalendarIntelligenceDialog
      open
      date="2026-07-26"
      onClose={vi.fn()}
      onCalendarChanged={vi.fn()}
      api={api}
    />,
  );
  await screen.findByText("Deterministic Calendar intelligence");
  await userEvent.click(screen.getByRole("tab", { name: "Connected" }));
  expect(screen.getByText("Not configured")).toBeVisible();
  expect(
    screen.queryByRole("link", { name: /Connect Google Calendar/ }),
  ).not.toBeInTheDocument();
});

it("honors saved immediate-create permission only for a clear low-risk Nexus event", async () => {
  const user = userEvent.setup();
  const { api, load, capture, applyProposal } = fakeApi();
  const immediatePayload = payload();
  immediatePayload.privacy.immediateCreateWithUndo = true;
  load.mockResolvedValue(immediatePayload);
  const safeEvent = {
    ...event,
    title: "Focus block",
    eventType: "personal" as const,
    sensitive: false,
  };
  const safeProposal: CalendarProposal = {
    ...proposal,
    summary: "Create Focus block on 2026-07-28",
    assumptions: [],
    operations: [
      {
        id: "proposal-1:create",
        type: "create-event",
        event: safeEvent,
        destinationSourceId: "nexus",
        reason: "Structured from the reviewed capture request.",
      },
    ],
  };
  capture.mockResolvedValue({
    preview: {
      ...preview,
      summary: safeProposal.summary,
      event: safeEvent,
      ambiguities: [],
    },
    proposal: safeProposal,
  });

  render(
    <CalendarIntelligenceDialog
      open
      date="2026-07-26"
      onClose={vi.fn()}
      onCalendarChanged={vi.fn()}
      api={api}
    />,
  );
  await screen.findByText("Deterministic Calendar intelligence");
  await user.type(
    screen.getByLabelText("Calendar request"),
    "Focus block 2026-07-28 at 2pm for one hour",
  );
  await user.click(screen.getByRole("button", { name: "Build preview" }));

  expect(applyProposal).toHaveBeenCalledWith("proposal-1", [
    "proposal-1:create",
  ]);
  expect(screen.queryByLabelText("Proposal review")).not.toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "Undo" })).toBeVisible();
});

it("reports a cancelled OAuth return without changing the local Calendar", async () => {
  window.history.replaceState(
    {},
    "",
    "/calendar?view=day&date=2026-07-26&google=denied",
  );
  render(<CalendarApp api={new FakeTimeApi()} />);
  expect(
    await screen.findByText(
      "Google Calendar connection was cancelled. No access was granted.",
    ),
  ).toBeVisible();
  expect(window.location.search).not.toContain("google=");
  expect(
    await screen.findByText("Keep the day in working memory"),
  ).toBeVisible();
});
