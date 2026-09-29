import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, expect, test } from "vitest";
import { formatDate, formatNumber } from "../report/format";
import DataTable from "./DataTable";

const columns = ["Region", "Product", "Amount", "Opened", "Note"];
const spans = [{ column: "Region", start_row: 0, length: 2 }];
const rows = [
  {
    Region: "North",
    Product: "A",
    Amount: 1234567,
    Opened: "2025-03-15",
    Note: null,
  },
  {
    Region: "North",
    Product: "B",
    Amount: 10,
    Opened: "2025-03-16",
    Note: "ok",
  },
];

beforeEach(() => {
  cleanup();
});

test("rowspan merges the group cell and omits it on the following row", () => {
  render(
    <DataTable
      columns={columns}
      rows={rows}
      spans={spans}
      mode="rowspan"
      emptyLabel="No rows match these settings"
      locale="en"
    />,
  );

  const table = screen.getByTestId("data-table");
  const bodyRows = within(table).getAllByRole("row").slice(1);
  const regionCells = within(table).getAllByRole("cell", { name: "North" });

  expect(regionCells).toHaveLength(1);
  expect(regionCells[0]).toHaveAttribute("rowspan", "2");
  expect(within(bodyRows[0]).getByRole("cell", { name: "A" })).toBeInTheDocument();
  expect(within(bodyRows[1]).getByRole("cell", { name: "B" })).toBeInTheDocument();
  expect(within(bodyRows[1]).queryByRole("cell", { name: "North" })).toBeNull();
  expect(within(bodyRows[1]).getAllByRole("cell")).toHaveLength(columns.length - 1);
});

test("aggregate mode renders every cell and ignores spans", () => {
  render(
    <DataTable
      columns={columns}
      rows={rows}
      spans={spans}
      mode="aggregate"
      emptyLabel="No rows match these settings"
      locale="en"
    />,
  );

  const table = screen.getByTestId("data-table");
  const bodyRows = within(table).getAllByRole("row").slice(1);
  const regionCells = within(table).getAllByRole("cell", { name: "North" });

  expect(regionCells).toHaveLength(2);
  for (const cell of regionCells) {
    expect(cell).not.toHaveAttribute("rowspan");
  }
  expect(within(bodyRows[0]).getAllByRole("cell")).toHaveLength(columns.length);
  expect(within(bodyRows[1]).getAllByRole("cell")).toHaveLength(columns.length);
});

test("empty rows render the empty label and no table", () => {
  render(
    <DataTable
      columns={columns}
      rows={[]}
      spans={spans}
      mode="rowspan"
      emptyLabel="No rows match these settings"
      locale="en"
    />,
  );

  expect(screen.getByTestId("data-empty")).toHaveTextContent(
    "No rows match these settings",
  );
  expect(screen.queryByTestId("data-table")).not.toBeInTheDocument();
});

test("formats grouped numbers, nulls, and ISO dates", () => {
  render(
    <DataTable
      columns={columns}
      rows={rows}
      spans={[]}
      mode="aggregate"
      emptyLabel="No rows match these settings"
      locale="en"
    />,
  );

  const amount = formatNumber(1234567, "en");
  expect(amount).toMatch(/1.234.567/);
  expect(screen.getByRole("cell", { name: amount })).toBeInTheDocument();

  expect(screen.getByRole("cell", { name: "\u2014" })).toBeInTheDocument();

  const opened = formatDate("2025-03-15", "en");
  const openedCell = screen.getByRole("cell", { name: opened });
  expect(openedCell.textContent.length).toBeGreaterThan(0);
  if (opened !== "2025-03-15") {
    expect(openedCell).not.toHaveTextContent("2025-03-15");
  }
});
