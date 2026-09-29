import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, expect, test, vi } from "vitest";
import "../i18n";
import { setLanguage } from "../i18n";
import SettingsForm from "./SettingsForm";
import { emptyDraft } from "./draft.js";

const columns = [
  { name: "Quantity", role: "metric" },
  { name: "Client_ID", role: "text" },
  { name: "Region", role: "category" },
  { name: "Transaction_Date", role: "datetime" },
];

function Harness({ onApply = () => {} }) {
  const [draft, setDraft] = useState(() => emptyDraft());
  return (
    <SettingsForm
      columns={columns}
      draft={draft}
      onChange={setDraft}
      onApply={onApply}
    />
  );
}

function operatorValues(index) {
  const select = screen.getByTestId(`condition-operator-${index}`);
  return [...select.querySelectorAll("option")].map((option) => option.value);
}

beforeEach(() => {
  cleanup();
  setLanguage("en");
});

test("text column offers contains and not gt", () => {
  render(<Harness />);
  fireEvent.click(screen.getByTestId("settings-add-condition"));
  fireEvent.change(screen.getByTestId("condition-column-0"), {
    target: { value: "Client_ID" },
  });
  const operators = operatorValues(0);
  expect(operators).toContain("contains");
  expect(operators).not.toContain("gt");
});

test("metric column offers gt and not contains", () => {
  render(<Harness />);
  fireEvent.click(screen.getByTestId("settings-add-condition"));
  fireEvent.change(screen.getByTestId("condition-column-0"), {
    target: { value: "Quantity" },
  });
  const operators = operatorValues(0);
  expect(operators).toContain("gt");
  expect(operators).not.toContain("contains");
});

test("the fourth sort is unavailable", () => {
  render(<Harness />);
  const addSort = screen.getByTestId("settings-add-sort");
  fireEvent.click(addSort);
  fireEvent.click(addSort);
  fireEvent.click(addSort);
  expect(addSort).toBeDisabled();
  expect(screen.getAllByTestId(/^sort-column-/)).toHaveLength(3);
  expect(screen.queryByTestId("sort-column-3")).not.toBeInTheDocument();
});

test("an in value keeps a trailing comma while typing", () => {
  render(<Harness />);
  fireEvent.click(screen.getByTestId("settings-add-condition"));
  fireEvent.change(screen.getByTestId("condition-operator-0"), {
    target: { value: "in" },
  });
  const input = screen.getByTestId("condition-value-0");
  fireEvent.change(input, { target: { value: "UAE," } });
  expect(input).toHaveValue("UAE,");
});

test("Apply does not call fetch", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  const onApply = vi.fn();
  try {
    render(<Harness onApply={onApply} />);
    fireEvent.click(screen.getByTestId("settings-apply"));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(onApply).toHaveBeenCalledTimes(1);
  } finally {
    fetchSpy.mockRestore();
  }
});

test("apply button uses the Russian label", async () => {
  render(<Harness />);
  await act(() => setLanguage("ru"));
  expect(screen.getByTestId("settings-apply")).toHaveTextContent("Применить");
  await act(() => setLanguage("en"));
});
