import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { expect, it, vi } from "vitest";
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

it("has no detectable accessibility violations in the empty Command state", async () => {
  const { container } = render(<CommandCenter api={new FakeCommandApi()} />);
  await screen.findByText("Set the direction");
  expect(await axe(container)).toHaveNoViolations();
});
