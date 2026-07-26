import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarApp } from "../components/calendar/CalendarApp";
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

describe("Calendar workflow", () => {
  beforeEach(() => {
    window.history.replaceState(
      {},
      "",
      "/calendar?view=agenda&date=2026-07-26",
    );
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("creates a recurring event and requires an explicit edit scope", async () => {
    const user = userEvent.setup();
    const api = new FakeTimeApi();
    render(<CalendarApp api={api} />);

    await screen.findByText("Your agenda is open");
    await user.click(screen.getByRole("button", { name: "Add event" }));
    await user.type(screen.getByLabelText("Title"), "Morning planning");
    await user.selectOptions(screen.getByLabelText("Repeat"), "weekly");
    await user.click(
      within(screen.getByRole("dialog", { name: "Add event" })).getByRole(
        "button",
        { name: "Add event" },
      ),
    );

    expect(await screen.findByText("Morning planning")).toBeVisible();
    expect(api.events[0].recurrence?.frequency).toBe("weekly");

    await user.click(
      screen.getByRole("button", { name: "Edit Morning planning" }),
    );
    const title = screen.getByLabelText("Title");
    await user.clear(title);
    await user.type(title, "Morning direction");
    await user.click(screen.getByRole("button", { name: "Review changes" }));

    const scope = await screen.findByRole("dialog", {
      name: "Apply recurring change",
    });
    await user.click(
      within(scope).getByRole("button", {
        name: /This and future events/,
      }),
    );
    await waitFor(() => expect(api.lastEventScope).toBe("future"));

    await user.click(
      screen.getByRole("button", { name: "Edit Morning direction" }),
    );
    await user.type(screen.getByLabelText("Notes (optional)"), "One exception");
    await user.click(screen.getByRole("button", { name: "Review changes" }));
    await user.click(
      within(
        await screen.findByRole("dialog", {
          name: "Apply recurring change",
        }),
      ).getByRole("button", { name: /This event only/ }),
    );
    await waitFor(() => expect(api.lastEventScope).toBe("occurrence"));

    await user.click(
      screen.getByRole("button", { name: "Remove Morning direction" }),
    );
    await user.click(
      within(
        await screen.findByRole("dialog", {
          name: "Remove recurring event",
        }),
      ).getByRole("button", { name: /All events in the series/ }),
    );
    await waitFor(() => expect(api.events).toHaveLength(0));
    expect(api.lastEventScope).toBe("series");
  });

  it("creates a top priority with an optional focus block", async () => {
    const user = userEvent.setup();
    const api = new FakeTimeApi();
    render(<CalendarApp api={api} />);
    await screen.findByText("Your agenda is open");

    await user.click(screen.getByRole("button", { name: "Priorities" }));
    await screen.findByText("Set the direction");
    await user.click(
      screen.getAllByRole("button", { name: "Add priority" })[0],
    );
    await user.type(screen.getByLabelText("Priority"), "Protect deep work");
    await user.type(screen.getByLabelText("Date"), "2026-07-27");
    await user.click(
      within(screen.getByRole("dialog", { name: "Add priority" })).getByRole(
        "button",
        { name: "Add priority" },
      ),
    );

    expect(await screen.findByText("Protect deep work")).toBeVisible();
    expect(api.priorities[0].isTop).toBe(true);
    expect(api.priorities[0].scheduledStartAt).toBeTruthy();
  });

  it("enforces, reorders, promotes, completes, and restores the top three", async () => {
    const user = userEvent.setup();
    const api = new FakeTimeApi();
    await api.createPriority({ title: "First", isTop: true });
    await api.createPriority({ title: "Second", isTop: true });
    await api.createPriority({ title: "Third", isTop: true });
    await api.createPriority({ title: "Fourth", isTop: false });
    window.history.replaceState(
      {},
      "",
      "/calendar?view=priorities&date=2026-07-26",
    );
    render(<CalendarApp api={api} />);
    await screen.findByText("What matters most");

    await user.click(screen.getByRole("button", { name: "Move Second up" }));
    expect(
      api.priorities.find((item) => item.title === "Second")?.position,
    ).toBe(0);
    await user.click(
      screen.getByRole("button", { name: "Demote First from top three" }),
    );
    const fourth = screen.getByText("Fourth").closest("li");
    expect(fourth).not.toBeNull();
    await user.click(
      within(fourth as HTMLElement).getByRole("button", {
        name: "Move to top three",
      }),
    );
    expect(api.priorities.find((item) => item.title === "Fourth")?.isTop).toBe(
      true,
    );

    await user.click(screen.getByRole("button", { name: "Complete Second" }));
    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(api.priorities.find((item) => item.title === "Second")?.status).toBe(
      "active",
    );
  });

  it("creates an all-day event, converts and reschedules it, then confirms removal", async () => {
    const user = userEvent.setup();
    const api = new FakeTimeApi();
    render(<CalendarApp api={api} />);
    await screen.findByText("Your agenda is open");

    await user.click(screen.getByRole("button", { name: "Add event" }));
    await user.type(screen.getByLabelText("Title"), "Personal reset");
    await user.click(screen.getByLabelText("All-day event"));
    await user.click(
      within(screen.getByRole("dialog", { name: "Add event" })).getByRole(
        "button",
        { name: "Add event" },
      ),
    );
    expect(api.events[0].allDay).toBe(true);

    await user.click(
      screen.getByRole("button", { name: "Edit Personal reset" }),
    );
    await user.click(screen.getByLabelText("All-day event"));
    const eventDialog = screen.getByRole("dialog", { name: "Edit event" });
    fireEvent.change(within(eventDialog).getByLabelText("Start date"), {
      target: { value: "2026-07-27" },
    });
    await user.click(screen.getByRole("button", { name: "Review changes" }));
    await waitFor(() => expect(api.events[0].allDay).toBe(false));
    expect(api.events[0].localDate).toBe("2026-07-27");

    await user.click(
      screen.getByRole("button", { name: "Remove Personal reset" }),
    );
    const confirmation = await screen.findByRole("dialog", {
      name: "Remove event",
    });
    await user.click(
      within(confirmation).getByRole("button", { name: "Remove event" }),
    );
    await waitFor(() => expect(api.events).toHaveLength(0));
  });

  it("preserves the empty view and exposes recovery after a load failure", async () => {
    const user = userEvent.setup();
    const api = new FakeTimeApi();
    api.failLoad = true;
    render(<CalendarApp api={api} />);

    expect(
      await screen.findByText("Personal time is unavailable"),
    ).toBeVisible();
    api.failLoad = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Your agenda is open")).toBeVisible();
  });

  it("creates a routine and preserves complete, undo, skip, and note history", async () => {
    const user = userEvent.setup();
    const api = new FakeTimeApi();
    render(<CalendarApp api={api} />);
    await screen.findByText("Your agenda is open");

    await user.click(screen.getByRole("button", { name: "Routines" }));
    await user.click(screen.getAllByRole("button", { name: "Add routine" })[0]);
    await user.type(screen.getByLabelText("Routine name"), "Evening reset");
    await user.click(
      within(screen.getByRole("dialog", { name: "Add routine" })).getByRole(
        "button",
        { name: "Add routine" },
      ),
    );

    expect(await screen.findAllByText("Evening reset")).not.toHaveLength(0);
    await user.click(
      screen.getByRole("button", { name: "Complete Evening reset" }),
    );
    expect(api.occurrences[0].status).toBe("completed");
    await user.click(
      screen.getByRole("button", { name: "Restore Evening reset" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Skip Evening reset" }),
    );
    expect(api.occurrences[0].status).toBe("skipped");

    await user.click(
      screen.getByRole("button", { name: "Add note to Evening reset" }),
    );
    const noteDialog = screen.getByRole("dialog", { name: "Routine note" });
    await user.type(
      within(noteDialog).getByLabelText("Note (optional)"),
      "Kept it brief",
    );
    await user.click(
      within(noteDialog).getByRole("button", { name: "Save note" }),
    );
    await waitFor(() => expect(api.occurrences[0].note).toBe("Kept it brief"));
  });

  it("configures overnight quiet hours and a truthful denied-permission state", async () => {
    const user = userEvent.setup();
    const api = new FakeTimeApi();
    render(<CalendarApp api={api} />);
    await screen.findByText("Your agenda is open");

    await user.click(
      screen.getByRole("button", {
        name: "Time and reminder settings",
      }),
    );
    await user.click(screen.getByLabelText("Enable quiet hours"));
    await user.selectOptions(
      screen.getByLabelText("Reminder behavior during quiet hours"),
      ["suppress"],
    );
    await user.click(
      screen.getByLabelText(
        "Device notification permission is denied or unavailable",
      ),
    );
    await user.click(screen.getByRole("button", { name: "Save preferences" }));

    await waitFor(() => expect(api.preferences.quietHoursEnabled).toBe(true));
    expect(api.preferences.quietHoursStart).toBe("22:00");
    expect(api.preferences.quietHoursEnd).toBe("07:00");
    expect(api.preferences.quietBehavior).toBe("suppress");
    expect(api.preferences.notificationPermission).toBe("denied");
  });

  it("keeps a legitimate overlap after explicit acknowledgement and reports offline state", async () => {
    const user = userEvent.setup();
    const api = new FakeTimeApi();
    api.conflictOnCreate = true;
    render(<CalendarApp api={api} />);
    await screen.findByText("Your agenda is open");

    await user.click(screen.getByRole("button", { name: "Add event" }));
    await user.type(screen.getByLabelText("Title"), "Double-booked by choice");
    await user.click(
      within(screen.getByRole("dialog", { name: "Add event" })).getByRole(
        "button",
        { name: "Add event" },
      ),
    );
    expect(
      await screen.findByRole("dialog", { name: "Review schedule overlap" }),
    ).toBeVisible();
    expect(screen.getByText(/Existing commitment/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save with overlap" }));
    expect(await screen.findByText("Double-booked by choice")).toBeVisible();

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    act(() => window.dispatchEvent(new Event("offline")));
    expect(
      await screen.findByText(/Offline. Showing the last loaded local view/),
    ).toBeVisible();
  });
});
