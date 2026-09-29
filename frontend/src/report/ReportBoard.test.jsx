import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test } from "vitest";
import ReportBoard from "./ReportBoard";

afterEach(() => {
  cleanup();
});

const titles = {
  preview: "Preview",
  columns: "Columns",
  size: "Size",
  dtypes: "Data types",
  missing: "Missing values",
  summary: "Summary",
  ranking: "Top and worst",
  grouping: "Grouping",
  timeseries: "Dynamics",
  insights: "Insights",
};

const labels = {
  rowCount: "Row count",
  columnCount: "Column count",
  top: "Top",
  worst: "Worst",
  metric: "Metric",
  category: "Category",
  date: "Date",
  truncated: "The list stops at 100 groups.",
  name: "Name",
  role: "Role",
  distinct: "Distinct",
  dtype: "Data type",
  missingCount: "Missing count",
  missingPercent: "Missing percent",
  filled: "Filled",
  numeric: "Numeric",
  other: "Other columns",
  count: "Count",
  mean: "Mean",
  std: "Std",
  min: "Min",
  p25: "25%",
  p50: "50%",
  p75: "75%",
  max: "Max",
  unique: "Unique",
  topValue: "Top value",
  frequency: "Frequency",
  value: "Value",
  sum: "Sum",
  unavailable:
    "There is no date column, no empty values, and no categorical column to describe.",
  empty: "\u2014",
};

function renderBoard(resetKey) {
  return render(
    <ReportBoard locale="en" titles={titles} labels={labels} resetKey={resetKey} />,
  );
}

test("renders the ten report cards in order", () => {
  renderBoard(1);
  const headings = screen.getAllByRole("heading").map((heading) => heading.textContent);
  expect(headings).toEqual([
    "Preview",
    "Columns",
    "Size",
    "Data types",
    "Missing values",
    "Summary",
    "Top and worst",
    "Grouping",
    "Dynamics",
    "Insights",
  ]);

  const insights = screen.getByTestId("card-insights");
  expect(insights).toHaveAttribute("data-status", "unavailable");
  expect(insights).toHaveTextContent(labels.unavailable);
});

test("preview shows the sample client and an em dash for a null metric", () => {
  renderBoard(1);
  const preview = screen.getByTestId("card-preview");
  expect(within(preview).getByText("Client_010")).toBeInTheDocument();
  expect(within(preview).getByText("\u2014")).toBeInTheDocument();
});

test("changing the ranking metric updates only that card", () => {
  renderBoard(1);
  const ranking = screen.getByTestId("card-ranking");
  fireEvent.change(within(ranking).getByRole("combobox"), { target: { value: "PnL" } });

  expect(within(screen.getByTestId("card-ranking")).getByText("42")).toBeInTheDocument();
  expect(within(screen.getByTestId("card-preview")).getByText("Client_010")).toBeInTheDocument();
  expect(within(screen.getByTestId("card-grouping")).getByText("USA")).toBeInTheDocument();
});

test("a new resetKey restores the ranking metric", () => {
  const { rerender } = renderBoard(1);
  const rankingSelect = () => within(screen.getByTestId("card-ranking")).getByRole("combobox");

  fireEvent.change(rankingSelect(), { target: { value: "PnL" } });
  expect(within(screen.getByTestId("card-ranking")).getByText("42")).toBeInTheDocument();

  rerender(<ReportBoard locale="en" titles={titles} labels={labels} resetKey={2} />);

  expect(rankingSelect()).toHaveValue("Quantity");
  const ranking = screen.getByTestId("card-ranking");
  expect(within(ranking).queryByText("42")).not.toBeInTheDocument();
  expect(within(ranking).getByText("500")).toBeInTheDocument();
});
