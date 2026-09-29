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
  pageSize: "100 rows",
  previous: "Previous",
  next: "Next",
};

function renderWindow(overrides = {}) {
  const onPrevious = vi.fn();
  const onNext = vi.fn();
  const onClose = vi.fn();
  render(
    <DataWindow
      columns={["Region", "PnL"]}
      rows={[]}
      spans={[]}
      mode="rowspan"
      page={1}
      totalPages={0}
      locale="en"
      labels={labels}
      onPrevious={onPrevious}
      onNext={onNext}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onPrevious, onNext, onClose };
}

test("renders dialog, close, pagination, and the empty state", () => {
  renderWindow();

  const dialog = screen.getByTestId("data-window");
  expect(dialog).toHaveAttribute("role", "dialog");
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(dialog).toHaveAttribute("aria-label", "Close");
  expect(screen.getByTestId("data-window-close")).toHaveAttribute(
    "aria-label",
    "Close",
  );
  expect(screen.getByTestId("pagination-bar")).toBeInTheDocument();
  expect(screen.getByTestId("data-empty")).toHaveTextContent(
    "No rows match these settings",
  );
  expect(screen.getByTestId("page-label").textContent).toBe("1 / 0");
  expect(screen.getByTestId("page-size").textContent).toBe("100 rows");
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
    page: 1,
    totalPages: 1,
  });

  const dialog = screen.getByTestId("data-window");
  const merged = screen.getByRole("cell", { name: "UAE" });
  expect(dialog).toContainElement(merged);
  expect(merged).toHaveAttribute("rowspan", "2");
});

test("pagination bar is not inside the zoomed content", () => {
  renderWindow();

  const zoomContent = screen.getByTestId("zoom-content");
  expect(zoomContent).not.toContainElement(screen.getByTestId("pagination-bar"));
});
