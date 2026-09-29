import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, test } from "vitest";
import ZoomSurface from "./ZoomSurface";

const originalMatchMedia = window.matchMedia;
const originalPointerEvent = window.PointerEvent;
let coarse = false;

function installPointerEvent() {
  if (typeof window.PointerEvent === "function") {
    return;
  }
  window.PointerEvent = class PointerEvent extends window.MouseEvent {
    constructor(type, init = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? "";
      this.isPrimary = init.isPrimary ?? true;
    }
  };
}

beforeEach(() => {
  cleanup();
  coarse = false;
  installPointerEvent();
  window.matchMedia = (query) => ({
    media: query,
    get matches() {
      return coarse;
    },
    addEventListener() {},
    removeEventListener() {},
  });
});

afterEach(() => {
  cleanup();
  if (originalMatchMedia === undefined) {
    delete window.matchMedia;
  } else {
    window.matchMedia = originalMatchMedia;
  }
  if (originalPointerEvent === undefined) {
    delete window.PointerEvent;
  } else {
    window.PointerEvent = originalPointerEvent;
  }
});

function renderSurface() {
  return render(
    <ZoomSurface>
      <span>rows</span>
    </ZoomSurface>,
  );
}

test("fine pointer shows zoom buttons and hides the pinch hint", () => {
  coarse = false;
  renderSurface();
  expect(screen.getByTestId("zoom-in")).toHaveTextContent("+");
  expect(screen.getByTestId("zoom-out").textContent).toBe("\u2212");
  expect(screen.queryByTestId("pinch-hint")).not.toBeInTheDocument();
});

test("clicking zoom-in raises data-scale from 1 to 1.1", () => {
  renderSurface();
  expect(screen.getByTestId("zoom-content")).toHaveAttribute("data-scale", "1");
  fireEvent.click(screen.getByTestId("zoom-in"));
  expect(screen.getByTestId("zoom-content")).toHaveAttribute("data-scale", "1.1");
});

test("zoom-in is disabled at scale 2 and zoom-out is disabled at scale 0.5", () => {
  renderSurface();
  const zoomIn = screen.getByTestId("zoom-in");
  for (let i = 0; i < 15; i += 1) {
    fireEvent.click(zoomIn);
  }
  expect(screen.getByTestId("zoom-content")).toHaveAttribute("data-scale", "2");
  expect(zoomIn).toBeDisabled();

  const zoomOut = screen.getByTestId("zoom-out");
  for (let i = 0; i < 20; i += 1) {
    fireEvent.click(zoomOut);
  }
  expect(screen.getByTestId("zoom-content")).toHaveAttribute("data-scale", "0.5");
  expect(zoomOut).toBeDisabled();
  expect(zoomIn).not.toBeDisabled();
});

test("clicking zoom-in 15 times from 1 ends at 2", () => {
  renderSurface();
  const zoomIn = screen.getByTestId("zoom-in");
  for (let i = 0; i < 15; i += 1) {
    fireEvent.click(zoomIn);
  }
  expect(screen.getByTestId("zoom-content")).toHaveAttribute("data-scale", "2");
});

test("coarse pointer hides zoom buttons and shows a non-interactive pinch hint", () => {
  coarse = true;
  renderSurface();
  expect(screen.queryByTestId("zoom-in")).not.toBeInTheDocument();
  expect(screen.queryByTestId("zoom-out")).not.toBeInTheDocument();
  const hint = screen.getByTestId("pinch-hint");
  expect(hint.tagName.toLowerCase()).toBe("svg");
  expect(hint).toHaveAttribute("aria-hidden", "true");
  expect(hint).not.toHaveAttribute("tabindex");
  expect(hint.querySelectorAll("circle")).toHaveLength(2);
  expect(window.getComputedStyle(hint).pointerEvents).toBe("none");
});

test("dragging the surface pans the content", () => {
  renderSurface();
  const surface = screen.getByTestId("zoom-surface");
  fireEvent.pointerDown(surface, { pointerId: 1, clientX: 0, clientY: 0 });
  fireEvent.pointerMove(surface, { pointerId: 1, clientX: 20, clientY: 10 });
  expect(screen.getByTestId("zoom-content").style.transform).toContain(
    "translate(20px, 10px)",
  );
});
