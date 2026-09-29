import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, expect, test, vi } from "vitest";
import { deleteDataset, fetchSection, selectSheet, uploadDataset } from "./api/datasets";
import App from "./App";
import { setLanguage } from "./i18n";
import { SECTION_ORDER } from "./report/sequence";
import { MAX_UPLOAD_BYTES } from "./upload/validateFile";

vi.mock("./api/datasets", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    uploadDataset: vi.fn(),
    selectSheet: vi.fn(),
    deleteDataset: vi.fn(),
    fetchSection: vi.fn(),
  };
});

const COLUMNS = [
  { name: "Transaction_Date", dtype: "datetime64[ns]", role: "datetime", unique_count: 90 },
  { name: "Client_ID", dtype: "object", role: "text", unique_count: 50 },
  { name: "Region", dtype: "object", role: "category", unique_count: 7 },
  { name: "Quantity", dtype: "int64", role: "metric", unique_count: 230 },
  { name: "PnL", dtype: "float64", role: "metric", unique_count: 280 },
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

function fileWith(name, size) {
  const file = new File(["x"], name, { type: "application/octet-stream" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function pickFile(name, size) {
  const input = document.querySelector('input[type="file"]');
  fireEvent.change(input, { target: { files: [fileWith(name, size)] } });
}

function responseFor(section, call, options) {
  if (section === "timeseries" && options.timeseriesUnavailable) {
    return {
      status: "unavailable",
      error: { message: "There is no date column for this block." },
    };
  }
  if (section === "preview") {
    return {
      status: "ok",
      data: {
        row_limit: 20,
        columns: ["Transaction_Date", "Client_ID", "Region", "Quantity", "PnL"],
        rows: [
          {
            Transaction_Date: "2025-01-01",
            Client_ID: "Client_010",
            Region: "UAE",
            Quantity: 7,
            PnL: null,
          },
        ],
      },
    };
  }
  if (section === "columns") {
    return {
      status: "ok",
      data: {
        columns: COLUMNS,
        suggestions: { metric: "Quantity", category: "Region", datetime: "Transaction_Date" },
      },
    };
  }
  if (section === "shape") {
    return { status: "ok", data: { row_count: 300, column_count: 5 } };
  }
  if (section === "dtypes") {
    return {
      status: "ok",
      data: { columns: COLUMNS.map(({ name, dtype, role }) => ({ name, dtype, role })) },
    };
  }
  if (section === "missing") {
    return {
      status: "ok",
      data: {
        columns: [{ name: "PnL", missing_count: 1, missing_pct: 0.33, non_null_count: 299 }],
      },
    };
  }
  if (section === "summary") {
    return {
      status: "ok",
      data: {
        numeric: [
          {
            column: "Quantity",
            count: 300,
            mean: 10,
            std: 1,
            min: 2,
            p25: 3,
            p50: 4,
            p75: 5,
            max: 500,
          },
        ],
        other: [{ column: "Region", count: 300, unique: 7, top: "USA", freq: 49 }],
      },
    };
  }
  if (section === "ranking") {
    const metric = call.params.metric || "Quantity";
    const top = metric === "PnL" ? 42 : 500;
    return {
      status: "ok",
      data: {
        metric,
        higher_is_better: true,
        top: [{ rank: 1, values: { [metric]: top } }],
        worst: [{ rank: 1, values: { [metric]: metric === "PnL" ? -5 : 2 } }],
      },
    };
  }
  if (section === "grouping") {
    return {
      status: "ok",
      data: {
        category: call.params.category || "Region",
        metric: call.params.metric || "Quantity",
        truncated: false,
        groups: [{ value: "USA", count: 49, sum: 12000, mean: 244.9 }],
      },
    };
  }
  if (section === "timeseries") {
    return {
      status: "ok",
      data: {
        date_column: "Transaction_Date",
        metric: "Quantity",
        grain: "day",
        points: [{ bucket: "2025-01-01", sum: 7 }],
      },
    };
  }
  return {
    status: "ok",
    data: {
      kind: "half_period",
      items: [{ text: options.insight }],
    },
  };
}

async function resolveNext(section, options) {
  const card = await screen.findByTestId(`card-${section}`);
  expect(card).toHaveAttribute("data-status", "loading");
  expect(within(card).getByTestId("card-skeleton")).toBeInTheDocument();

  const call = calls.find((item) => item.section === section && !item.settled);
  expect(call).toBeTruthy();
  expect(call.datasetId).toBe(options.datasetId ?? "ds-1");
  expect(call.params.lang).toBe(options.lang ?? "en");

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

async function playReport(options = {}) {
  const seen = [];
  for (const section of SECTION_ORDER) {
    seen.push(await resolveNext(section, options));
  }
  return seen;
}

async function uploadReady(name, datasetId) {
  uploadDataset.mockResolvedValueOnce({ status: "ready", dataset_id: datasetId });
  pickFile(name, 20);
  await screen.findByTestId("card-preview");
  expect(screen.getByTestId("upload-zone")).toHaveAttribute("data-collapsed", "true");
  expect(screen.getByTestId("upload-button")).toBeEnabled();
  expect(screen.getByTestId("upload-button")).toHaveTextContent("Replace file");
}

beforeEach(async () => {
  cleanup();
  calls.length = 0;
  uploadDataset.mockReset();
  selectSheet.mockReset();
  deleteDataset.mockReset();
  fetchSection.mockReset();
  deleteDataset.mockResolvedValue(undefined);
  fetchSection.mockImplementation((datasetId, section, params) => {
    const gate = deferred();
    calls.push({ datasetId, section, params, ...gate });
    return gate.promise;
  });
  localStorage.clear();
  await setLanguage("en");
});

test("renders the product name", () => {
  render(<App />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Analytics Platform");
});

test("language switch flips a header string and an upload string", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  render(<App />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Analytics Platform");
  expect(screen.getByTestId("upload-button")).toHaveTextContent("Upload file");

  fireEvent.click(screen.getByRole("button", { name: "RU" }));

  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Аналитическая платформа");
  expect(screen.getByTestId("upload-button")).toHaveTextContent("Загрузить файл");
  expect(localStorage.getItem("lang")).toBe("ru");
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(uploadDataset).not.toHaveBeenCalled();
  expect(fetchSection).not.toHaveBeenCalled();
  expect(deleteDataset).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});

test("rejects a file over 100 MB and a disallowed extension without collapsing", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  render(<App />);

  pickFile("huge.csv", MAX_UPLOAD_BYTES + 1);
  expect(screen.getByRole("alert")).toHaveTextContent("The file is larger than 100 MB.");
  expect(screen.getByTestId("upload-zone")).toHaveAttribute("data-collapsed", "false");
  expect(screen.queryByTestId("card-preview")).not.toBeInTheDocument();

  pickFile("photo.png", 100);
  expect(screen.getByRole("alert")).toHaveTextContent("This file type is not supported.");
  expect(screen.getByTestId("upload-zone")).toHaveAttribute("data-collapsed", "false");
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(uploadDataset).not.toHaveBeenCalled();
  expect(fetchSection).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});

test("cards appear one after another and an unavailable dynamics card still leaves summary and insights", async () => {
  render(<App />);
  await uploadReady("nodate.csv", "ds-1");
  const seen = await playReport({
    timeseriesUnavailable: true,
    insight: "Insight after dynamics.",
  });

  expect(seen.map((call) => call.section)).toEqual(SECTION_ORDER);
  expect(calls.map((call) => call.section)).toEqual(SECTION_ORDER);
  expect(screen.getByTestId("card-summary")).toHaveTextContent("USA");
  const timeseries = screen.getByTestId("card-timeseries");
  expect(timeseries).toHaveAttribute("data-status", "unavailable");
  expect(timeseries).toHaveTextContent("There is no date column for this block.");
  expect(screen.getByTestId("card-insights")).toHaveTextContent("Insight after dynamics.");
  expect(screen.getByTestId("card-preview")).toHaveTextContent("Client_010");
});

test("a rejected replace does not delete the current dataset and keeps the report", async () => {
  render(<App />);
  await uploadReady("trades.csv", "ds-1");
  await playReport({ insight: "First insight." });

  uploadDataset.mockRejectedValueOnce(new Error("The file could not be read."));
  pickFile("bad.csv", 20);

  expect(await screen.findByRole("alert")).toHaveTextContent("The file could not be read.");
  expect(deleteDataset).not.toHaveBeenCalled();
  expect(screen.getByTestId("card-preview")).toHaveTextContent("Client_010");
  expect(screen.getByTestId("card-insights")).toHaveTextContent("First insight.");
  expect(screen.getByTestId("upload-zone")).toHaveAttribute("data-collapsed", "true");
  expect(screen.getByTestId("upload-button")).toHaveTextContent("Replace file");
  expect(screen.getByTestId("upload-button")).toBeEnabled();
});

test("sheet cancel on a replace deletes only the new id and keeps the previous report", async () => {
  render(<App />);
  await uploadReady("trades.csv", "ds-1");
  await playReport({ insight: "First insight." });

  uploadDataset.mockResolvedValueOnce({
    status: "sheet_required",
    dataset_id: "ds-2",
    sheets: ["Trades", "Clients"],
  });
  pickFile("book.xlsx", 40);

  expect(await screen.findByTestId("sheet-dialog")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Choose a sheet" })).toBeInTheDocument();
  expect(screen.getByText("Trades")).toBeInTheDocument();
  expect(screen.getByText("Clients")).toBeInTheDocument();
  expect(screen.getByTestId("upload-zone")).toHaveAttribute("data-collapsed", "true");
  expect(screen.getByTestId("card-preview")).toHaveTextContent("Client_010");
  expect(deleteDataset).not.toHaveBeenCalled();

  pickFile("ignored.csv", 20);
  expect(uploadDataset).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId("sheet-dialog")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  await waitFor(() => {
    expect(screen.queryByTestId("sheet-dialog")).not.toBeInTheDocument();
  });
  expect(deleteDataset).toHaveBeenCalledTimes(1);
  expect(deleteDataset).toHaveBeenCalledWith("ds-2", { lang: "en" });
  expect(screen.getByTestId("card-preview")).toHaveTextContent("Client_010");
  expect(screen.getByTestId("card-insights")).toHaveTextContent("First insight.");
  expect(fetchSection.mock.calls.every((call) => call[0] === "ds-1")).toBe(true);
});

test("sheet confirm on a replace deletes the previous id and loads the new report", async () => {
  render(<App />);
  await uploadReady("trades.csv", "ds-1");
  await playReport({ insight: "First insight." });

  uploadDataset.mockResolvedValueOnce({
    status: "sheet_required",
    dataset_id: "ds-2",
    sheets: ["Trades", "Clients"],
  });
  pickFile("book.xlsx", 40);
  expect(await screen.findByTestId("sheet-dialog")).toBeInTheDocument();
  expect(deleteDataset).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("radio", { name: "Trades" }));
  selectSheet.mockResolvedValueOnce({ dataset_id: "ds-2", status: "ready", sheet: "Trades" });
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  await waitFor(() => {
    expect(selectSheet).toHaveBeenCalledWith("ds-2", "Trades", { lang: "en" });
  });
  expect(deleteDataset).toHaveBeenCalledTimes(1);
  expect(deleteDataset).toHaveBeenCalledWith("ds-1", { lang: "en" });
  expect(screen.queryByTestId("sheet-dialog")).not.toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByTestId("card-preview")).toHaveAttribute("data-status", "loading");
  });
  await playReport({ datasetId: "ds-2", insight: "Second insight." });
  expect(screen.getByTestId("card-insights")).toHaveTextContent("Second insight.");
  expect(fetchSection.mock.calls.filter((call) => call[1] === "preview").some((call) => call[0] === "ds-2")).toBe(
    true,
  );
});

test("changing the ranking metric requests ranking only", async () => {
  render(<App />);
  await uploadReady("trades.csv", "ds-1");
  await playReport({ insight: "Stable insight." });

  const count = (section) => fetchSection.mock.calls.filter((call) => call[1] === section).length;
  const before = Object.fromEntries(SECTION_ORDER.map((section) => [section, count(section)]));

  fireEvent.change(within(screen.getByTestId("card-ranking")).getByRole("combobox"), {
    target: { value: "PnL" },
  });

  await waitFor(() => {
    expect(fetchSection).toHaveBeenCalledWith("ds-1", "ranking", { lang: "en", metric: "PnL" });
  });
  for (const section of SECTION_ORDER) {
    if (section !== "ranking") {
      expect(count(section)).toBe(before[section]);
    }
  }
  expect(count("ranking")).toBe(before.ranking + 1);
  expect(count("insights")).toBe(1);

  const reload = calls.find((call) => call.section === "ranking" && !call.settled);
  await act(async () => {
    reload.resolve(responseFor("ranking", reload, {}));
  });

  expect(await screen.findByText("42")).toBeInTheDocument();
  expect(screen.getByTestId("card-ranking")).not.toHaveTextContent("500");
  expect(screen.getByTestId("card-preview")).toHaveTextContent("Client_010");
  expect(screen.getByTestId("card-grouping")).toHaveTextContent("USA");
  expect(screen.getByTestId("card-insights")).toHaveTextContent("Stable insight.");
});

test("a ready upload collapses the zone and applies column suggestions", async () => {
  render(<App />);
  expect(screen.getByTestId("upload-zone")).toHaveAttribute("data-collapsed", "false");
  await uploadReady("trades.csv", "ds-1");
  const seen = await playReport({ insight: "PnL decreased by 30.1%." });

  expect(screen.getByTestId("upload-zone")).toHaveAttribute("data-collapsed", "true");
  const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
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
  expect(within(screen.getByTestId("card-ranking")).getByRole("combobox")).toHaveValue("Quantity");
  expect(within(screen.getByTestId("card-grouping")).getByRole("combobox", { name: "Category" })).toHaveValue(
    "Region",
  );
  expect(within(screen.getByTestId("card-grouping")).getByRole("combobox", { name: "Metric" })).toHaveValue(
    "Quantity",
  );
  expect(within(screen.getByTestId("card-timeseries")).getByRole("combobox", { name: "Date" })).toHaveValue(
    "Transaction_Date",
  );
  expect(within(screen.getByTestId("card-timeseries")).getByRole("combobox", { name: "Metric" })).toHaveValue(
    "Quantity",
  );
  expect(within(screen.getByTestId("card-insights")).getByRole("combobox", { name: "Date" })).toHaveValue(
    "Transaction_Date",
  );
  expect(seen.find((call) => call.section === "ranking").params).toEqual({
    lang: "en",
    metric: "Quantity",
  });
  expect(seen.find((call) => call.section === "grouping").params).toEqual({
    lang: "en",
    category: "Region",
    metric: "Quantity",
  });
  expect(seen.find((call) => call.section === "timeseries").params).toEqual({
    lang: "en",
    dateColumn: "Transaction_Date",
    metric: "Quantity",
  });
  expect(seen.find((call) => call.section === "insights").params).toEqual({
    lang: "en",
    dateColumn: "Transaction_Date",
  });
  expect(screen.getByTestId("card-preview")).toHaveTextContent("\u2014");
});

test("switching language refetches every section and shows the server insight", async () => {
  render(<App />);
  await uploadReady("trades.csv", "ds-1");
  await playReport({ insight: "PnL decreased by 30.1%." });

  fireEvent.click(screen.getByRole("button", { name: "Data settings" }));
  fireEvent.click(screen.getByTestId("settings-add-condition"));
  expect(screen.getByTestId("condition-column-0")).toHaveValue("Transaction_Date");

  fireEvent.click(screen.getByRole("button", { name: "RU" }));
  await waitFor(() => {
    expect(screen.getByTestId("card-preview")).toHaveAttribute("data-status", "loading");
  });
  expect(screen.getByTestId("settings-apply")).toHaveTextContent("Применить");
  expect(screen.getByTestId("condition-column-0").querySelectorAll("option")).toHaveLength(5);

  const seen = await playReport({
    lang: "ru",
    insight: "PnL снизился на 30,1% между первой и второй половиной периода.",
  });

  expect(seen).toHaveLength(10);
  expect(seen.map((call) => call.section)).toEqual(SECTION_ORDER);
  for (const call of seen) {
    expect(call.params.lang).toBe("ru");
  }
  expect(screen.getByRole("heading", { name: "Просмотр" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Инсайты" })).toBeInTheDocument();
  expect(screen.getByTestId("card-insights")).toHaveTextContent(
    "PnL снизился на 30,1% между первой и второй половиной периода.",
  );
  expect(screen.getByTestId("card-insights")).not.toHaveTextContent(
    "Нет колонки с датой, пустых значений и категориальной колонки, которые можно описать.",
  );
  expect(screen.getByTestId("upload-button")).toHaveTextContent("Заменить файл");
});

function stubMatchMedia() {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  });
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockRowsFetch(handler) {
  const recorded = [];
  const previous = globalThis.fetch;
  const fetchMock = vi.fn(async (url, init = {}) => {
    const body = JSON.parse(init.body);
    const call = { url: String(url), method: init.method, body };
    recorded.push(call);
    return handler(call, recorded.length - 1);
  });
  globalThis.fetch = fetchMock;
  return {
    recorded,
    restore() {
      globalThis.fetch = previous;
    },
  };
}

function rowsPayload({ page, totalPages, region }) {
  return {
    page,
    page_size: 100,
    total_rows: 1,
    total_pages: totalPages,
    columns: ["Region"],
    group: null,
    rows: [{ Region: region }],
    spans: [],
  };
}

test("Apply success calls the rows route once and closes the sidebar", async () => {
  render(<App />);
  await uploadReady("trades.csv", "ds-1");
  await playReport({ insight: "Stable insight." });
  stubMatchMedia();

  const sectionCalls = fetchSection.mock.calls.length;
  const previewText = screen.getByTestId("card-preview").textContent;
  const rows = mockRowsFetch(() =>
    jsonResponse(200, rowsPayload({ page: 1, totalPages: 1, region: "UAE" })),
  );

  try {
    fireEvent.click(screen.getByRole("button", { name: "Data settings" }));
    fireEvent.click(screen.getByTestId("settings-apply"));

    await waitFor(() => {
      expect(screen.queryByTestId("settings-panel")).not.toBeInTheDocument();
    });

    expect(rows.recorded).toHaveLength(1);
    expect(rows.recorded[0].method).toBe("POST");
    expect(rows.recorded[0].url).toBe("/api/v1/datasets/ds-1/rows?lang=en");
    expect(rows.recorded[0].body.page).toBe(1);
    expect(rows.recorded[0].body.filter).toBeNull();
    expect(rows.recorded[0].body.sort).toBeNull();
    expect(rows.recorded[0].body.group).toBeNull();
    expect(screen.getByTestId("data-window")).toBeInTheDocument();
    expect(screen.getByTestId("data-window")).toHaveTextContent("UAE");
    expect(fetchSection.mock.calls).toHaveLength(sectionCalls);
    expect(screen.getByTestId("card-preview").textContent).toBe(previewText);
  } finally {
    rows.restore();
  }
});

test("a 422 renders the message and does not render the dialog", async () => {
  render(<App />);
  await uploadReady("trades.csv", "ds-1");
  await playReport({ insight: "Stable insight." });
  stubMatchMedia();

  const previewText = screen.getByTestId("card-preview").textContent;
  const rows = mockRowsFetch(() =>
    jsonResponse(422, {
      error: { code: "invalid_filter", message: "Condition 0 is invalid." },
    }),
  );

  try {
    fireEvent.click(screen.getByRole("button", { name: "Data settings" }));
    fireEvent.click(screen.getByTestId("settings-apply"));

    expect(await screen.findByTestId("settings-error")).toHaveTextContent("Condition 0 is invalid.");
    expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("data-window")).not.toBeInTheDocument();
    expect(screen.getByTestId("card-preview").textContent).toBe(previewText);
  } finally {
    rows.restore();
  }
});

test("paging and close keep the report and the applied draft", async () => {
  render(<App />);
  await uploadReady("trades.csv", "ds-1");
  await playReport({ insight: "Stable insight." });
  stubMatchMedia();

  const sectionCalls = fetchSection.mock.calls.length;
  const previewText = screen.getByTestId("card-preview").textContent;
  const rows = mockRowsFetch((call) =>
    jsonResponse(
      200,
      rowsPayload({
        page: call.body.page,
        totalPages: 2,
        region: call.body.page === 1 ? "UAE" : "UK",
      }),
    ),
  );

  try {
    fireEvent.click(screen.getByRole("button", { name: "Data settings" }));
    fireEvent.click(screen.getByTestId("settings-apply"));
    expect(await screen.findByTestId("data-window")).toHaveTextContent("UAE");

    await waitFor(() => {
      expect(screen.getByTestId("data-window")).toHaveTextContent("UK");
    });
    expect(screen.getByTestId("data-window")).toHaveTextContent("UAE");
    expect(screen.queryByTestId("pagination-next")).not.toBeInTheDocument();
    expect(rows.recorded.at(-1).method).toBe("POST");
    expect(rows.recorded.at(-1).body.page).toBe(2);
    expect(fetchSection.mock.calls).toHaveLength(sectionCalls);

    fireEvent.click(screen.getByTestId("data-window-close"));
    expect(screen.queryByTestId("data-window")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("settings-tab"));
    expect(screen.queryByTestId("condition-column-0")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("settings-add-condition"));
    expect(screen.getByTestId("condition-column-0")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("settings-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("card-preview").textContent).toBe(previewText);

    fireEvent.click(screen.getByTestId("settings-tab"));
    expect(screen.queryByTestId("condition-column-0")).not.toBeInTheDocument();
  } finally {
    rows.restore();
  }
});

test("a later 422 does not replace an open window", async () => {
  render(<App />);
  await uploadReady("trades.csv", "ds-1");
  await playReport({ insight: "Stable insight." });
  stubMatchMedia();

  let calls = 0;
  const rows = mockRowsFetch(() => {
    calls += 1;
    if (calls === 1) {
      return jsonResponse(200, rowsPayload({ page: 1, totalPages: 1, region: "UAE" }));
    }
    return jsonResponse(422, { error: { code: "invalid_filter", message: "Bad filter." } });
  });

  try {
    fireEvent.click(screen.getByRole("button", { name: "Data settings" }));
    fireEvent.click(screen.getByTestId("settings-apply"));
    expect(await screen.findByTestId("data-window")).toHaveTextContent("UAE");

    fireEvent.click(screen.getByTestId("settings-tab"));
    expect(screen.getByTestId("data-window")).toHaveTextContent("UAE");
    fireEvent.click(screen.getByTestId("settings-apply"));

    expect(await screen.findByTestId("settings-error")).toHaveTextContent("Bad filter.");
    expect(screen.getByTestId("data-window")).toHaveTextContent("UAE");
  } finally {
    rows.restore();
  }
});
