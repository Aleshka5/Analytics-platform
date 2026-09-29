import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, expect, test, vi } from "vitest";
import { fetchSection } from "../api/datasets";
import ReportBoard from "./ReportBoard";
import { SECTION_ORDER } from "./sequence";

vi.mock("../api/datasets", () => ({
  uploadDataset: vi.fn(),
  selectSheet: vi.fn(),
  deleteDataset: vi.fn(),
  fetchSection: vi.fn(),
}));

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
  unavailable: "Catalog sentence that must not be shown.",
  empty: "\u2014",
};

const SAMPLE_COLUMNS = [
  { name: "Transaction_Date", dtype: "datetime64[ns]", role: "datetime", unique_count: 90 },
  { name: "Client_ID", dtype: "object", role: "text", unique_count: 50 },
  { name: "Region", dtype: "object", role: "category", unique_count: 7 },
  { name: "Quantity", dtype: "int64", role: "metric", unique_count: 230 },
  { name: "PnL", dtype: "float64", role: "metric", unique_count: 280 },
];

const ALT_COLUMNS = [
  { name: "Trade_Date", dtype: "datetime64[ns]", role: "datetime", unique_count: 12 },
  { name: "Desk", dtype: "object", role: "category", unique_count: 3 },
  { name: "Amount", dtype: "int64", role: "metric", unique_count: 8 },
];

const calls = [];

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject, settled: false };
}

function columnsFor(datasetId) {
  return datasetId === "ds-2" ? ALT_COLUMNS : SAMPLE_COLUMNS;
}

function suggestionsFor(datasetId) {
  if (datasetId === "ds-2") {
    return { metric: "Amount", category: "Desk", datetime: "Trade_Date" };
  }
  return { metric: "Quantity", category: "Region", datetime: "Transaction_Date" };
}

function responseFor(section, call, options) {
  const columns = columnsFor(call.datasetId);
  if (section === "preview") {
    return {
      status: "ok",
      data: {
        columns: ["Transaction_Date", "Client_ID", "PnL"],
        rows: [{ Transaction_Date: "2025-01-01", Client_ID: "Client_010", PnL: null, Note: "" }],
      },
    };
  }
  if (section === "columns") {
    return {
      status: "ok",
      data: { columns, suggestions: suggestionsFor(call.datasetId) },
    };
  }
  if (section === "shape") {
    return { status: "ok", data: { row_count: 300, column_count: columns.length } };
  }
  if (section === "dtypes") {
    return {
      status: "ok",
      data: { columns: columns.map(({ name, dtype, role }) => ({ name, dtype, role })) },
    };
  }
  if (section === "missing") {
    return {
      status: "ok",
      data: { columns: [{ name: "PnL", missing_count: 1, missing_pct: 0.33, non_null_count: 299 }] },
    };
  }
  if (section === "summary") {
    return {
      status: "ok",
      data: {
        numeric: [{ column: "Quantity", count: 1, mean: 1, std: 1, min: 1, p25: 1, p50: 1, p75: 1, max: 1 }],
        other: [{ column: "Region", count: 1, unique: 1, top: "USA", freq: 1 }],
      },
    };
  }
  if (section === "ranking") {
    const metric = call.params.metric;
    const top = metric === "PnL" ? 42 : metric === "Amount" ? 9 : 500;
    return {
      status: "ok",
      data: {
        metric,
        higher_is_better: true,
        top: [{ rank: 1, values: { [metric]: top } }],
        worst: [{ rank: 1, values: { [metric]: 2 } }],
      },
    };
  }
  if (section === "grouping") {
    return {
      status: "ok",
      data: {
        category: call.params.category,
        metric: call.params.metric,
        truncated: false,
        groups: [{ value: "USA", count: 49, sum: 12000, mean: 244.9 }],
      },
    };
  }
  if (section === "timeseries") {
    if (options.timeseriesUnavailable) {
      return {
        status: "unavailable",
        error: { message: "There is no date column for this block." },
      };
    }
    return {
      status: "ok",
      data: { grain: "day", points: [{ bucket: "2025-01-01", sum: 7 }] },
    };
  }
  if (options.insightsUnavailable) {
    return {
      status: "unavailable",
      error: { message: "There is no date column for this block." },
    };
  }
  return {
    status: "ok",
    data: { items: [{ text: options.insight || "Server insight." }] },
  };
}

function renderBoard({ datasetId = "ds-1", lang = "en" } = {}) {
  return render(<ReportBoard datasetId={datasetId} lang={lang} titles={titles} labels={labels} />);
}

async function resolveNext(section, options = {}) {
  const card = await screen.findByTestId(`card-${section}`);
  expect(card).toHaveAttribute("data-status", "loading");
  const call = calls.find((item) => item.section === section && !item.settled);
  expect(call).toBeTruthy();
  const next = SECTION_ORDER[SECTION_ORDER.indexOf(section) + 1];
  if (next) {
    expect(calls.some((item) => item.section === next && !item.settled)).toBe(false);
  }
  call.settled = true;
  await act(async () => {
    call.resolve(responseFor(section, call, options));
  });
  return call;
}

async function playReport(options) {
  const seen = [];
  for (const section of SECTION_ORDER) {
    seen.push(await resolveNext(section, options));
  }
  return seen;
}

beforeEach(() => {
  cleanup();
  calls.length = 0;
  fetchSection.mockReset();
  fetchSection.mockImplementation((datasetId, section, params) => {
    const gate = deferred();
    calls.push({ datasetId, section, params, ...gate });
    return gate.promise;
  });
});

test("loads cards from the API and shows an em dash for an empty preview cell", async () => {
  renderBoard();
  const preview = await screen.findByTestId("card-preview");
  expect(preview).toHaveAttribute("data-status", "loading");
  expect(within(preview).getByTestId("card-skeleton")).toBeInTheDocument();

  const seen = await playReport({ timeseriesUnavailable: true });

  expect(seen.map((call) => call.section)).toEqual(SECTION_ORDER);
  expect(within(screen.getByTestId("card-preview")).getByText("Client_010")).toBeInTheDocument();
  expect(within(screen.getByTestId("card-preview")).getAllByText("\u2014").length).toBeGreaterThan(0);
  const timeseries = screen.getByTestId("card-timeseries");
  expect(timeseries).toHaveAttribute("data-status", "unavailable");
  expect(timeseries).toHaveTextContent("There is no date column for this block.");
  expect(timeseries).not.toHaveTextContent(labels.unavailable);
  expect(screen.getByTestId("card-summary")).toHaveTextContent("USA");
  expect(screen.getByTestId("card-insights")).toHaveTextContent("Server insight.");
  expect(within(screen.getByTestId("card-ranking")).getByRole("combobox")).toHaveValue("Quantity");
});

test("changing the ranking metric refetches ranking and leaves the other cards", async () => {
  renderBoard();
  await playReport();

  const insightsBefore = fetchSection.mock.calls.filter((call) => call[1] === "insights").length;
  fireEvent.change(within(screen.getByTestId("card-ranking")).getByRole("combobox"), {
    target: { value: "PnL" },
  });

  await waitFor(() => {
    expect(fetchSection).toHaveBeenCalledWith("ds-1", "ranking", { lang: "en", metric: "PnL" });
  });
  expect(fetchSection.mock.calls.filter((call) => call[1] === "insights")).toHaveLength(insightsBefore);

  const reload = calls.find((call) => call.section === "ranking" && !call.settled);
  await act(async () => {
    reload.settled = true;
    reload.resolve(responseFor("ranking", reload, {}));
  });

  expect(within(screen.getByTestId("card-ranking")).getByText("42")).toBeInTheDocument();
  expect(within(screen.getByTestId("card-preview")).getByText("Client_010")).toBeInTheDocument();
  expect(within(screen.getByTestId("card-grouping")).getByText("USA")).toBeInTheDocument();
});

test("a new datasetId resets selectors to that dataset's suggestions", async () => {
  const { rerender } = renderBoard();
  await playReport();
  fireEvent.change(within(screen.getByTestId("card-ranking")).getByRole("combobox"), {
    target: { value: "PnL" },
  });
  const reload = calls.find((call) => call.section === "ranking" && !call.settled);
  await act(async () => {
    reload.settled = true;
    reload.resolve(responseFor("ranking", reload, {}));
  });

  rerender(<ReportBoard datasetId="ds-2" lang="en" titles={titles} labels={labels} />);
  await waitFor(() => {
    expect(screen.getByTestId("card-preview")).toHaveAttribute("data-status", "loading");
  });
  await playReport();

  expect(within(screen.getByTestId("card-ranking")).getByRole("combobox")).toHaveValue("Amount");
  expect(within(screen.getByTestId("card-grouping")).getByRole("combobox", { name: "Category" })).toHaveValue(
    "Desk",
  );
  expect(within(screen.getByTestId("card-timeseries")).getByRole("combobox", { name: "Date" })).toHaveValue(
    "Trade_Date",
  );
  expect(fetchSection).toHaveBeenCalledWith("ds-2", "ranking", { lang: "en", metric: "Amount" });
  expect(screen.getByTestId("card-ranking")).not.toHaveTextContent("42");
});

test("a language change refetches with the current metric instead of the suggestion", async () => {
  const { rerender } = renderBoard();
  await playReport();
  fireEvent.change(within(screen.getByTestId("card-ranking")).getByRole("combobox"), {
    target: { value: "PnL" },
  });
  const reload = calls.find((call) => call.section === "ranking" && !call.settled);
  await act(async () => {
    reload.settled = true;
    reload.resolve(responseFor("ranking", reload, {}));
  });

  rerender(<ReportBoard datasetId="ds-1" lang="ru" titles={titles} labels={labels} />);
  await waitFor(() => {
    expect(screen.getByTestId("card-preview")).toHaveAttribute("data-status", "loading");
  });
  const seen = await playReport({ insight: "Серверный текст." });

  expect(seen.find((call) => call.section === "ranking").params).toEqual({ lang: "ru", metric: "PnL" });
  expect(seen.every((call) => call.params.lang === "ru")).toBe(true);
  expect(within(screen.getByTestId("card-ranking")).getByRole("combobox")).toHaveValue("PnL");
  expect(screen.getByTestId("card-insights")).toHaveTextContent("Серверный текст.");
});
