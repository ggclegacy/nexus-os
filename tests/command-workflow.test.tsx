import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandCenter } from "../components/command/CommandCenter";
import { FakeCommandApi } from "./fixtures";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
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

describe("Command Center workflow", () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("creates, edits, reorders, and completes priorities", async () => {
    const user = userEvent.setup();
    const api = new FakeCommandApi();
    render(<CommandCenter api={api} />);

    await screen.findByText("Set the direction");
    await user.click(
      screen.getByRole("button", { name: "Add first priority" }),
    );
    await user.type(screen.getByLabelText("Priority"), "Prepare the week");
    await user.click(
      within(screen.getByRole("dialog", { name: "Add priority" })).getByRole(
        "button",
        { name: "Add priority" },
      ),
    );
    expect(await screen.findByText("Prepare the week")).toBeVisible();

    await user.click(screen.getAllByRole("button", { name: "Add" })[0]);
    await user.type(screen.getByLabelText("Priority"), "Train with intent");
    await user.click(
      within(screen.getByRole("dialog", { name: "Add priority" })).getByRole(
        "button",
        { name: "Add priority" },
      ),
    );
    expect(await screen.findByText("Train with intent")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Move Train with intent up" }),
    );
    expect(
      api.priorities.find((item) => item.title === "Train with intent")
        ?.position,
    ).toBe(0);

    await user.click(
      screen.getByRole("button", { name: "Edit Prepare the week" }),
    );
    const input = screen.getByLabelText("Priority");
    await user.clear(input);
    await user.type(input, "Prepare next week");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Prepare next week")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Complete Prepare next week" }),
    );
    expect(await screen.findByText("1 completed")).toBeVisible();
  });

  it("creates and edits a timeline item", async () => {
    const user = userEvent.setup();
    const api = new FakeCommandApi();
    render(<CommandCenter api={api} />);

    await screen.findByText("Your timeline is open");
    await user.click(
      screen.getAllByRole("button", { name: "Add timeline item" })[0],
    );
    await user.type(screen.getByLabelText("Title"), "Review the week");
    await user.click(
      within(
        screen.getByRole("dialog", { name: "Add timeline item" }),
      ).getByRole("button", { name: "Add to timeline" }),
    );
    await waitFor(() => expect(api.timeline).toHaveLength(1));
    expect(await screen.findByText("Review the week")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Edit Review the week" }),
    );
    const input = screen.getByLabelText("Title");
    await user.clear(input);
    await user.type(input, "Review and reset");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Review and reset")).toBeVisible();
  });

  it("recovers from a simulated page failure", async () => {
    const user = userEvent.setup();
    const api = new FakeCommandApi();
    api.failLoad = true;
    render(<CommandCenter api={api} />);

    expect(await screen.findByText("Command is unavailable")).toBeVisible();
    api.failLoad = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Set the direction")).toBeVisible();
  });

  it("supports keyboard access to the primary action", async () => {
    const user = userEvent.setup();
    const api = new FakeCommandApi();
    render(<CommandCenter api={api} />);
    await screen.findByText("Set the direction");

    const skipLink = screen.getByRole("link", { name: "Skip to today" });
    skipLink.focus();
    expect(skipLink).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("link", { name: "Nexus OS Command" }),
    ).toHaveFocus();
  });

  it("does not auto-promote ordinary priorities and restores a removed record in place", async () => {
    const user = userEvent.setup();
    const api = new FakeCommandApi();
    const ordinary = await api.createPriority({
      title: "Ordinary upcoming item",
      isTop: false,
    });
    ordinary.isTop = false;
    const protectedPriority = await api.createPriority({
      title: "Preserve this record",
      notes: "Keep the original identifier",
      isTop: true,
    });
    protectedPriority.isTop = true;

    render(<CommandCenter api={api} />);
    await screen.findByText("Preserve this record");
    expect(
      screen.queryByText("Ordinary upcoming item"),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Delete Preserve this record" }),
    );
    expect(await screen.findByRole("button", { name: "Undo" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() =>
      expect(
        api.priorities.find((item) => item.id === protectedPriority.id)
          ?.archivedAt,
      ).toBeNull(),
    );
  });
});
