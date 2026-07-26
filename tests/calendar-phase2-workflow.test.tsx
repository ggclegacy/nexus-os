import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarApp } from "../components/calendar/CalendarApp";
import type { CalendarEventInput, ReminderInstance } from "../lib/time/types";
import { FakeTimeApi } from "./fixtures";

vi.mock("next/navigation", () => ({
  usePathname: () => "/calendar",
}));

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

function eventInput(
  title: string,
  eventType: CalendarEventInput["eventType"],
  date = "2026-07-26",
): CalendarEventInput {
  return {
    title,
    eventType,
    notes: "",
    location: "",
    provider: "",
    meetingUrl: "",
    amount: eventType === "financial" ? 95 : null,
    currency: "USD",
    paymentStatus: eventType === "financial" ? "unpaid" : null,
    priority: "standard",
    status: "scheduled",
    allDay: true,
    localDate: date,
    endLocalDate: date,
    startTime: null,
    endTime: null,
    timeZone: "America/Chicago",
    recurrence: null,
    reminderOffsets: [],
  };
}

describe("Calendar Phase 2 workflows", () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("renders a stable Month grid and adds to a selected date", async () => {
    window.history.replaceState({}, "", "/calendar?view=month&date=2026-07-26");
    const user = userEvent.setup();
    const api = new FakeTimeApi();
    render(<CalendarApp api={api} />);

    const grid = await screen.findByRole("grid", { name: "Month calendar" });
    expect(within(grid).getAllByRole("gridcell")).toHaveLength(42);
    await user.click(screen.getByRole("button", { name: /Select .*Jul 30/ }));
    await user.click(screen.getByRole("button", { name: "Add event" }));
    expect(
      within(screen.getByRole("dialog", { name: "Add event" })).getByLabelText(
        "Start date",
      ),
    ).toHaveValue("2026-07-30");
  });

  it("moves between birthday and bill planning and resolves a bill", async () => {
    window.history.replaceState(
      {},
      "",
      "/calendar?view=birthdays&date=2026-07-26",
    );
    const user = userEvent.setup();
    const api = new FakeTimeApi();
    await api.createEvent({
      ...eventInput("Maya birthday", "birthday", "2026-08-01"),
      relationship: "Friend",
      birthYear: 1990,
      giftIdea: "Book",
    });
    await api.createEvent(
      eventInput("Internet bill", "financial", "2026-07-28"),
    );
    render(<CalendarApp api={api} />);

    expect(await screen.findByText("Maya birthday")).toBeVisible();
    await user.click(
      within(
        screen.getByRole("group", { name: "Planning workspaces" }),
      ).getByRole("button", { name: "Bills" }),
    );
    expect(await screen.findByText("Internet bill")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Mark paid" }));
    await waitFor(() =>
      expect(
        api.events.find((item) => item.title === "Internet bill"),
      ).toMatchObject({
        paymentStatus: "paid",
        status: "completed",
      }),
    );
  });

  it("persists reminder dismissal from the Reminder Center", async () => {
    window.history.replaceState(
      {},
      "",
      "/calendar?view=reminders&date=2026-07-26",
    );
    const user = userEvent.setup();
    const api = new FakeTimeApi();
    const event = await api.createEvent(
      eventInput("Take action", "reminder", "2026-07-26"),
    );
    const reminder: ReminderInstance = {
      id: "instance-1",
      reminderId: "rule-1",
      eventId: event.id,
      occurrenceDate: event.occurrenceDate,
      occurrenceKey: event.occurrenceKey,
      scheduledFor: "2026-07-26T10:00:00.000Z",
      deliveredAt: "2026-07-26T10:00:00.000Z",
      seenAt: null,
      snoozedUntil: null,
      resolvedAt: null,
      state: "delivered",
      reason: "User-configured event reminder.",
      ruleLabel: "At event time",
      escalationLevel: 0,
      nextEscalationAt: null,
      createdAt: "2026-07-26T10:00:00.000Z",
      updatedAt: "2026-07-26T10:00:00.000Z",
    };
    api.reminderInstances.push(reminder);
    render(<CalendarApp api={api} />);

    expect(await screen.findByText("Take action")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(reminder.state).toBe("dismissed"));
    expect(screen.getByText("Resolved history")).toBeVisible();
  });
});
