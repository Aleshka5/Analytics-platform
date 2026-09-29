import { expect, test } from "vitest";
import { appendRowsPage } from "./appendPage";

test("the first page is stored as-is", () => {
  const loaded = appendRowsPage(null, {
    page: 1,
    total_pages: 2,
    columns: ["Region"],
    group: { mode: "rowspan", columns: ["Region"] },
    rows: [{ Region: "UAE" }, { Region: "UAE" }],
    spans: [{ column: "Region", start_row: 0, length: 2 }],
  });

  expect(loaded.rows).toEqual([{ Region: "UAE" }, { Region: "UAE" }]);
  expect(loaded.spans).toEqual([{ column: "Region", start_row: 0, length: 2 }]);
  expect(loaded.page).toBe(1);
});

test("the next page is appended and a continued group stays one span", () => {
  const first = appendRowsPage(null, {
    page: 1,
    total_pages: 2,
    columns: ["Region", "PnL"],
    group: { mode: "rowspan", columns: ["Region"] },
    rows: [
      { Region: "UAE", PnL: 1 },
      { Region: "UAE", PnL: 2 },
    ],
    spans: [{ column: "Region", start_row: 0, length: 2 }],
  });
  const loaded = appendRowsPage(first, {
    page: 2,
    total_pages: 2,
    columns: ["Region", "PnL"],
    group: { mode: "rowspan", columns: ["Region"] },
    rows: [
      { Region: "UAE", PnL: 3 },
      { Region: "UK", PnL: 4 },
      { Region: "UK", PnL: 5 },
    ],
    spans: [{ column: "Region", start_row: 1, length: 2 }],
  });

  expect(loaded.rows.map((row) => row.PnL)).toEqual([1, 2, 3, 4, 5]);
  expect(loaded.page).toBe(2);
  expect(loaded.spans).toEqual([
    { column: "Region", start_row: 0, length: 3 },
    { column: "Region", start_row: 3, length: 2 },
  ]);
});
