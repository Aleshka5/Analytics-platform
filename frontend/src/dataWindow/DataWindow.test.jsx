import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import DataWindow from "./DataWindow";

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  window.matchMedia = (query) => ({
    media: query,
    matches: false,
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
});

const labels = {
  close: "Close",
  empty: "No rows match these settings",
};

function renderWindow(overrides = {}) {
  const onReachEnd = vi.fn();
  const onClose = vi.fn();
  render(
    <DataWindow
      columns={["Region", "PnL"]}
      rows={[]}
      spans={[]}
      mode="rowspan"
      locale="en"
      labels={labels}
      hasMore={false}
      onReachEnd={onReachEnd}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onReachEnd, onClose };
}

test("renders dialog, close, and the empty state", () => {
  renderWindow();

  const dialog = screen.getByTestId("data-window");
  expect(dialog).toHaveAttribute("role", "dialog");
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(dialog).toHaveAttribute("aria-label", "Close");
  expect(screen.getByTestId("data-window-close")).toHaveAttribute(
    "aria-label",
    "Close",
  );
  expect(screen.queryByTestId("pagination-bar")).not.toBeInTheDocument();
  expect(screen.getByTestId("data-empty")).toHaveTextContent(
    "No rows match these settings",
  );
});

test("close click calls onClose", () => {
  const { onClose } = renderWindow();

  fireEvent.click(screen.getByTestId("data-window-close"));

  expect(onClose).toHaveBeenCalledTimes(1);
});

test("a rowspan fixture renders a merged cell inside the dialog", () => {
  renderWindow({
    rows: [
      { Region: "UAE", PnL: 10 },
      { Region: "UAE", PnL: 20 },
    ],
    spans: [{ column: "Region", start_row: 0, length: 2 }],
    mode: "rowspan",
    hasMore: false,
  });

  const dialog = screen.getByTestId("data-window");
  const merged = screen.getByRole("cell", { name: "UAE" });
  expect(dialog).toContainElement(merged);
  expect(merged).toHaveAttribute("rowspan", "2");
});

test("reaching the end of the table requests the next page", () => {
  const { onReachEnd } = renderWindow({
    rows: [{ Region: "UAE", PnL: 10 }],
    hasMore: true,
  });

  expect(onReachEnd).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("zoom-content")).toContainElement(
    screen.getByTestId("table-end"),
  );
});

test("the end marker does not request a page when nothing follows", () => {
  const { onReachEnd } = renderWindow({
    rows: [{ Region: "UAE", PnL: 10 }],
    hasMore: false,
  });

  expect(onReachEnd).not.toHaveBeenCalled();
});
