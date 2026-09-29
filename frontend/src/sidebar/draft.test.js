import { expect, test } from "vitest";
import {
  addCondition,
  addSort,
  canAddSort,
  emptyDraft,
  operatorsForRole,
  setCondition,
  setGroupColumns,
} from "./draft";

const COLUMNS = [
  { name: "Region", role: "category" },
  { name: "Client_ID", role: "text" },
  { name: "PnL", role: "metric" },
  { name: "Transaction_Date", role: "datetime" },
];

test("empty draft shape", () => {
  expect(emptyDraft()).toEqual({
    combinator: "and",
    conditions: [],
    sorts: [],
    groupColumns: [],
    groupMode: "rowspan",
  });
  expect(emptyDraft()).not.toBe(emptyDraft());
});

test("operators follow column role", () => {
  const metric = operatorsForRole("metric");
  const text = operatorsForRole("text");
  const datetime = operatorsForRole("datetime");
  const category = operatorsForRole("category");

  expect(metric).not.toContain("contains");
  expect(text).not.toContain("gt");
  expect(datetime).toContain("gt");
  expect(datetime).not.toContain("contains");
  expect(category).toContain("contains");
  expect(metric).toEqual(["eq", "gt", "gte", "lt", "lte", "between", "in", "empty", "not_empty"]);
  expect(text).toEqual(["eq", "contains", "in", "empty", "not_empty"]);
  expect(datetime).toEqual(["eq", "gt", "gte", "lt", "lte", "between", "in", "empty", "not_empty"]);
  expect(category).toEqual(["eq", "contains", "in", "empty", "not_empty"]);
  expect(operatorsForRole("unknown")).toEqual(["eq", "in", "empty", "not_empty"]);
});

test("addCondition uses the first column and a legal operator", () => {
  const draft = emptyDraft();
  const next = addCondition(draft, COLUMNS);

  expect(next).not.toBe(draft);
  expect(draft.conditions).toEqual([]);
  expect(next.conditions).toEqual([{ column: "Region", operator: "eq", value: "" }]);
  expect(operatorsForRole("category")).toContain(next.conditions[0].operator);
});

test("addCondition with no columns does not add a row", () => {
  const draft = emptyDraft();

  expect(addCondition(draft, [])).toBe(draft);
  expect(draft.conditions).toEqual([]);
});

test("fourth addSort is a no-op", () => {
  let draft = emptyDraft();
  draft = addSort(draft, COLUMNS);
  draft = addSort(draft, COLUMNS);
  draft = addSort(draft, COLUMNS);

  expect(canAddSort(draft)).toBe(false);
  expect(draft.sorts).toEqual([
    { column: "Region", direction: "asc" },
    { column: "Region", direction: "asc" },
    { column: "Region", direction: "asc" },
  ]);
  expect(addSort(draft, COLUMNS)).toBe(draft);

  const empty = emptyDraft();
  expect(addSort(empty, [])).toBe(empty);
});

test("setGroupColumns drops metric columns", () => {
  const next = setGroupColumns(
    emptyDraft(),
    ["PnL", "Region", "Missing", "Transaction_Date", "Client_ID"],
    COLUMNS,
  );

  expect(next.groupColumns).toEqual(["Region", "Transaction_Date", "Client_ID"]);
});

test("setCondition resets an illegal operator when the column role changes", () => {
  const draft = setCondition(
    addCondition(emptyDraft(), [{ name: "Client_ID", role: "text" }]),
    0,
    { operator: "contains", value: "acme" },
    COLUMNS,
  );
  const next = setCondition(draft, 0, { column: "PnL" }, COLUMNS);

  expect(draft.conditions[0]).toEqual({ column: "Client_ID", operator: "contains", value: "acme" });
  expect(next.conditions[0]).toEqual({ column: "PnL", operator: "eq", value: "" });
  expect(operatorsForRole("metric")).not.toContain("contains");
});
