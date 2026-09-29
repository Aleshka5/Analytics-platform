import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test, vi } from "vitest";
import FormatDialog from "./FormatDialog";

afterEach(() => {
  cleanup();
});

const formats = [
  { id: "xlsx", label: "Excel" },
  { id: "pdf", label: "PDF" },
];

function renderDialog(props = {}) {
  const onConfirm = vi.fn();
  const onDismiss = vi.fn();
  render(
    <FormatDialog
      formats={formats}
      onConfirm={onConfirm}
      onDismiss={onDismiss}
      {...props}
    />,
  );
  return { onConfirm, onDismiss };
}

test("renders Excel and PDF and confirms pdf", () => {
  const { onConfirm, onDismiss } = renderDialog();

  expect(screen.getByRole("dialog", { name: "Export" })).toHaveAttribute(
    "aria-modal",
    "true",
  );
  expect(screen.getByText("Excel")).toBeInTheDocument();
  expect(screen.getByText("PDF")).toBeInTheDocument();

  fireEvent.click(screen.getByTestId("format-pdf"));

  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onConfirm).toHaveBeenCalledWith("pdf");
  expect(onDismiss).not.toHaveBeenCalled();
});

test("dismisses from the button, the scrim, and Escape", () => {
  const fromButton = renderDialog();
  fireEvent.click(screen.getByTestId("format-dismiss"));
  expect(fromButton.onDismiss).toHaveBeenCalledTimes(1);
  expect(fromButton.onConfirm).not.toHaveBeenCalled();
  cleanup();

  const fromScrim = renderDialog();
  fireEvent.click(screen.getByTestId("format-scrim"));
  expect(fromScrim.onDismiss).toHaveBeenCalledTimes(1);
  expect(fromScrim.onConfirm).not.toHaveBeenCalled();
  cleanup();

  const fromEscape = renderDialog();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(fromEscape.onDismiss).toHaveBeenCalledTimes(1);
  expect(fromEscape.onConfirm).not.toHaveBeenCalled();
});

test("shows errorMessage and omits the node when it is null", () => {
  renderDialog({ errorMessage: "This export format is not supported." });
  expect(screen.getByTestId("format-error")).toHaveTextContent(
    "This export format is not supported.",
  );
  cleanup();

  renderDialog({ errorMessage: null });
  expect(screen.queryByTestId("format-error")).not.toBeInTheDocument();
});
