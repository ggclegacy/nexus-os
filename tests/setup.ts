import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";
import { toHaveNoViolations } from "jest-axe";
import { expect } from "vitest";

expect.extend(toHaveNoViolations);
configure({ asyncUtilTimeout: 5_000 });

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
}

if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

Object.defineProperty(window.navigator, "onLine", {
  configurable: true,
  value: true,
});
