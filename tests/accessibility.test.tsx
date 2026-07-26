import { render, screen } from "@testing-library/react";
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
