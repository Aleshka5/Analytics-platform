import { expect, test } from "vitest";
import { cardsSettled } from "./cardsSettled";
import { SECTION_ORDER } from "./sequence";

function cardsWith(phase, overrides = {}) {
  return SECTION_ORDER.map((name) => ({
    name,
    phase: overrides[name] ?? phase,
  }));
}

test("one loading card is not settled", () => {
  expect(cardsSettled(cardsWith("ok", { insights: "loading" }))).toBe(false);
});

test("all ten ok cards are settled", () => {
  expect(cardsSettled(cardsWith("ok"))).toBe(true);
});

test("an unavailable card still counts as settled", () => {
  expect(cardsSettled(cardsWith("ok", { grouping: "unavailable" }))).toBe(true);
});

test("pending or error phases follow the settled set", () => {
  expect(cardsSettled(cardsWith("ok", { preview: "pending" }))).toBe(false);
  expect(cardsSettled(cardsWith("error"))).toBe(true);
});

test("the wrong length or a missing name is not settled", () => {
  expect(cardsSettled(cardsWith("ok").slice(1))).toBe(false);
  const renamed = cardsWith("ok").map((card) =>
    card.name === "insights" ? { ...card, name: "notes" } : card,
  );
  expect(cardsSettled(renamed)).toBe(false);
});
