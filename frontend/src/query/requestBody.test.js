import { expect, test } from "vitest";
import { draftToQueryBody } from "./requestBody";

const COLUMNS = [
  { name: "Region", role: "category" },
  { name: "PnL", role: "metric" },
  { name: "Transaction_Date", role: "datetime" },
  { name: "Client_ID", role: "text" },
];

function draft(overrides = {}) {
  return {
    combinator: "and",
    conditions: [],
    sorts: [],
    groupColumns: [],
    groupMode: "rowspan",
    ...overrides,
  };
}

test("empty draft becomes filter, sort, and group null with page 1", () => {
  expect(draftToQueryBody(draft(), COLUMNS)).toEqual({
    filter: null,
    sort: null,
    group: null,
    page: 1,
  });
});

test("conditions, sorts, and group columns are mapped", () => {
  const body = draftToQueryBody(
    draft({
      combinator: "or",
      conditions: [{ column: "Region", operator: "eq", value: "UAE" }],
      sorts: [{ column: "PnL", direction: "desc" }],
      groupColumns: ["Region"],
      groupMode: "aggregate",
    }),
    COLUMNS,
    2,
  );

  expect(body).toEqual({
    filter: {
      combinator: "or",
      conditions: [{ column: "Region", operator: "eq", value: "UAE" }],
    },
    sort: [{ column: "PnL", direction: "desc" }],
    group: { mode: "aggregate", columns: ["Region"] },
    page: 2,
  });
  expect(body).not.toHaveProperty("page_size");
});

test("metric values are coerced to numbers when they are finite", () => {
  const body = draftToQueryBody(
    draft({
      conditions: [
        { column: "PnL", operator: "gt", value: "10" },
        { column: "PnL", operator: "between", value: ["1", "2"] },
        { column: "PnL", operator: "in", value: ["3", "x"] },
      ],
    }),
    COLUMNS,
  );

  expect(body.filter.conditions).toEqual([
    { column: "PnL", operator: "gt", value: 10 },
    { column: "PnL", operator: "between", value: [1, 2] },
    { column: "PnL", operator: "in", value: [3, "x"] },
  ]);
});

test("empty operator omits value", () => {
  const body = draftToQueryBody(
    draft({
      conditions: [{ column: "Region", operator: "empty", value: null }],
    }),
    COLUMNS,
  );

  expect(body.filter.conditions).toEqual([{ column: "Region", operator: "empty" }]);
  expect(body.filter.conditions[0]).not.toHaveProperty("value");
});

test("returned body does not alias draft conditions", () => {
  const source = draft({
    conditions: [{ column: "Region", operator: "in", value: ["UAE"] }],
    sorts: [{ column: "Region", direction: "asc" }],
    groupColumns: ["Region"],
  });
  const body = draftToQueryBody(source, COLUMNS);

  body.filter.conditions.push({ column: "PnL", operator: "gt", value: 1 });
  body.filter.conditions[0].value.push("UK");
  body.filter.conditions[0].column = "Client_ID";

  expect(source.conditions).toEqual([{ column: "Region", operator: "in", value: ["UAE"] }]);
});
