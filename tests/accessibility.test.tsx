import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { expect, it, vi } from "vitest";
import { CommandCenter } from "../components/command/CommandCenter";
import { CalendarApp } from "../components/calendar/CalendarApp";
import { FakeCommandApi, FakeTimeApi } from "./fixtures";

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

it("has no detectable accessibility violations in the empty Command state", async () => {
  const { container } = render(<CommandCenter api={new FakeCommandApi()} />);
  await screen.findByText("Set the direction");
  expect(await axe(container)).toHaveNoViolations();
});

it("has no detectable accessibility violations in the empty Calendar state", async () => {
  window.history.replaceState({}, "", "/calendar?view=agenda&date=2026-07-26");
  const { container } = render(<CalendarApp api={new FakeTimeApi()} />);
  await screen.findByText("Your agenda is open");
  expect(await axe(container)).toHaveNoViolations();
});

it("has no detectable accessibility violations in populated Command and its editor", async () => {
  const user = userEvent.setup();
  const api = new FakeCommandApi();
  await api.createPriority({ title: "Protect the focus block" });
  const { container } = render(<CommandCenter api={api} />);
  await screen.findByText("Protect the focus block");
  expect(await axe(container)).toHaveNoViolations();

  await user.click(
    screen.getByRole("button", { name: "Edit Protect the focus block" }),
  );
  expect(
    await screen.findByRole("dialog", { name: "Edit priority" }),
  ).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();
});

it("has no detectable accessibility violations in the populated Calendar Today view", async () => {
  const api = new FakeTimeApi();
  await api.createEvent({
    title: "Long-form personal planning",
    notes: "Private planning context",
    location: "Home",
    eventType: "meeting",
    provider: "",
    meetingUrl: "",
    amount: null,
    currency: "USD",
    paymentStatus: null,
    priority: "standard",
    status: "scheduled",
    allDay: false,
    localDate: "2026-07-26",
    endLocalDate: "2026-07-26",
    startTime: "09:00",
    endTime: "10:00",
    timeZone: "America/Chicago",
    recurrence: null,
    reminderOffsets: [15],
  });
  window.history.replaceState({}, "", "/calendar?view=day&date=2026-07-26");
  const { container } = render(<CalendarApp api={api} />);
  expect(
    await screen.findAllByText("Long-form personal planning"),
  ).not.toHaveLength(0);
  expect(screen.getByText("Keep the day in working memory")).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();
});

it("has no detectable accessibility violations in the Calendar Month view", async () => {
  window.history.replaceState({}, "", "/calendar?view=month&date=2026-07-26");
  const { container } = render(<CalendarApp api={new FakeTimeApi()} />);
  expect(
    await screen.findByRole("grid", { name: "Month calendar" }),
  ).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();
});
