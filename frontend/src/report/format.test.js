import { expect, test } from "vitest";
import { formatDate, formatNumber } from "./format";

test("formatNumber keeps at most two fraction digits", () => {
  const formatted = formatNumber(253.3366, "en");
  expect(formatted).toContain("253");
  const fraction = formatted.split(".")[1] ?? "";
  expect(fraction.length).toBeLessThanOrEqual(2);
});

test("formatNumber returns null for an empty value", () => {
  expect(formatNumber(null, "en")).toBeNull();
});

test("formatDate returns a short date for an ISO day", () => {
  const formatted = formatDate("2025-01-01", "en");
  expect(typeof formatted).toBe("string");
  expect(formatted.length).toBeGreaterThan(0);
});

test("formatDate returns null for an empty value", () => {
  expect(formatDate(null, "en")).toBeNull();
});
