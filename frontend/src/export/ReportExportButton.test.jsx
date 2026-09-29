import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import ReportExportButton from "./ReportExportButton";

const LABELS = { action: "Export", excel: "Excel", pdf: "PDF" };
const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

const originalMatchMedia = window.matchMedia;
let finePointer = false;

function advance(ms) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function renderButton({ onConfirm = vi.fn(), ...props } = {}) {
  render(
    <ReportExportButton
      labels={LABELS}
      errorMessage={null}
      settled
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return onConfirm;
}

beforeEach(() => {
  cleanup();
  finePointer = false;
  vi.useFakeTimers();
  window.matchMedia = (query) => ({
    media: query,
    get matches() {
      return finePointer && query === FINE_POINTER_QUERY;
    },
    addEventListener() {},
    removeEventListener() {},
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  if (originalMatchMedia === undefined) {
    delete window.matchMedia;
  } else {
    window.matchMedia = originalMatchMedia;
  }
});

test("is absent while the report has not settled", () => {
  renderButton({ settled: false });
  expect(screen.queryByTestId("report-export")).not.toBeInTheDocument();
});

test("starts as a pill and collapses to a circle after 10 seconds", () => {
  renderButton();
  const button = screen.getByTestId("report-export");
  expect(button).toHaveAttribute("data-state", "pill");
  expect(button).toHaveAttribute("aria-label", "Export");
  advance(10_000);
  expect(button).toHaveAttribute("data-state", "circle");
  expect(button).toHaveAttribute("aria-label", "Export");
});

test("a fine pointer expands the circle and mouse leave collapses it", () => {
  finePointer = true;
  renderButton();
  advance(10_000);
  const button = screen.getByTestId("report-export");
  expect(button).toHaveAttribute("data-state", "circle");
  fireEvent.mouseEnter(button);
  expect(button).toHaveAttribute("data-state", "circle");
  expect(button).toHaveAttribute("data-expanded", "true");
  fireEvent.mouseLeave(button);
  expect(button).not.toHaveAttribute("data-expanded");
});

test("confirming pdf starts a cooldown and ignores clicks until it ends", () => {
  const onConfirm = renderButton();
  fireEvent.click(screen.getByTestId("report-export"));
  fireEvent.click(screen.getByTestId("format-pdf"));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onConfirm).toHaveBeenCalledWith("pdf");

  const button = screen.getByTestId("report-export");
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute("data-state", "cooldown");
  expect(screen.queryByTestId("format-dialog")).not.toBeInTheDocument();

  fireEvent.click(button);
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId("format-dialog")).not.toBeInTheDocument();

  advance(10_000);
  expect(button).toBeEnabled();
  expect(button).toHaveAttribute("data-state", "circle");
});

test("a rejected download keeps the dialog open during the cooldown", async () => {
  const onConfirm = vi.fn(() => Promise.reject(new Error("failed")));
  const view = render(
    <ReportExportButton labels={LABELS} errorMessage={null} settled onConfirm={onConfirm} />,
  );

  fireEvent.click(screen.getByTestId("report-export"));
  fireEvent.click(screen.getByTestId("format-pdf"));

  await act(async () => {
    await Promise.resolve();
  });

  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("report-export")).toBeDisabled();
  expect(screen.getByTestId("format-dialog")).toBeInTheDocument();

  view.rerender(
    <ReportExportButton
      labels={LABELS}
      errorMessage="This export format is not supported."
      settled
      onConfirm={onConfirm}
    />,
  );

  expect(screen.getByTestId("format-error")).toHaveTextContent(
    "This export format is not supported.",
  );
  fireEvent.click(screen.getByTestId("format-pdf"));
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

test("dismissing the dialog does not start the cooldown", () => {
  const onConfirm = renderButton();
  fireEvent.click(screen.getByTestId("report-export"));
  fireEvent.click(screen.getByTestId("format-dismiss"));
  expect(onConfirm).not.toHaveBeenCalled();
  const button = screen.getByTestId("report-export");
  expect(button).toBeEnabled();
  expect(button).not.toHaveAttribute("data-state", "cooldown");
});
