import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test, vi } from "vitest";
import SheetDialog from "./SheetDialog";

afterEach(() => {
  cleanup();
});

function renderDialog() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <SheetDialog
      sheets={["Trades", "Clients"]}
      title="Choose a sheet"
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
}

test("confirms the selected sheet", () => {
  const { onConfirm, onCancel } = renderDialog();

  expect(screen.getByText("Trades")).toBeInTheDocument();
  expect(screen.getByText("Clients")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();

  fireEvent.click(screen.getByRole("radio", { name: "Clients" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onConfirm).toHaveBeenCalledWith("Clients");
  expect(onCancel).not.toHaveBeenCalled();
});

test("cancel does not confirm", () => {
  const { onConfirm, onCancel } = renderDialog();

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onConfirm).not.toHaveBeenCalled();
});
