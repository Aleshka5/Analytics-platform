import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test, vi } from "vitest";
import TableExport from "./TableExport";

const labels = {
  action: "Export",
  excel: "Excel",
  csv: "CSV",
  json: "JSON",
};

afterEach(() => {
  cleanup();
});

function renderExport(overrides = {}) {
  const onExport = overrides.onExport ?? vi.fn();
  const onDismiss = overrides.onDismiss ?? vi.fn();
  const view = render(
    <TableExport
      labels={labels}
      errorMessage={overrides.errorMessage ?? null}
      busy={overrides.busy ?? false}
      onExport={onExport}
      onDismiss={onDismiss}
    />,
  );
  return { ...view, onExport, onDismiss };
}

test("button shows Export", () => {
  renderExport();
  expect(screen.getByTestId("table-export")).toHaveTextContent("Export");
  expect(screen.getByTestId("table-export")).toHaveAttribute("type", "button");
});

test("choosing CSV calls onExport with only the format id", () => {
  const { onExport } = renderExport();

  fireEvent.click(screen.getByTestId("table-export"));
  fireEvent.click(screen.getByTestId("format-csv"));

  expect(onExport).toHaveBeenCalledTimes(1);
  expect(onExport).toHaveBeenCalledWith("csv");
  expect(onExport.mock.calls[0]).toEqual(["csv"]);
});

test("dismiss does not call onExport", () => {
  const { onExport, onDismiss } = renderExport();

  fireEvent.click(screen.getByTestId("table-export"));
  fireEvent.click(screen.getByTestId("format-dismiss"));

  expect(onExport).not.toHaveBeenCalled();
  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId("format-dialog")).not.toBeInTheDocument();
});

test("busy disables the button and a click does not open the dialog", () => {
  renderExport({ busy: true });

  const button = screen.getByTestId("table-export");
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(screen.queryByTestId("format-dialog")).not.toBeInTheDocument();
});

test("a rejected export keeps the dialog open and shows the server message", async () => {
  const onExport = vi.fn(() => Promise.reject(new Error("failed")));
  const view = renderExport({ onExport });

  fireEvent.click(screen.getByTestId("table-export"));
  fireEvent.click(screen.getByTestId("format-csv"));

  await act(async () => {
    await Promise.resolve();
  });

  expect(screen.getByTestId("format-dialog")).toBeInTheDocument();

  view.rerender(
    <TableExport
      labels={labels}
      errorMessage="This export format is not supported."
      busy={false}
      onExport={onExport}
    />,
  );

  expect(screen.getByTestId("format-error")).toHaveTextContent(
    "This export format is not supported.",
  );
});
