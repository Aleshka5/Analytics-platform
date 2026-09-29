import { SECTION_ORDER } from "./sequence";

const SETTLED_PHASES = new Set(["ok", "unavailable", "error"]);

export function cardsSettled(cards) {
  if (!Array.isArray(cards) || cards.length !== SECTION_ORDER.length) {
    return false;
  }

  const expected = new Set(SECTION_ORDER);
  const seen = new Set();

  for (const card of cards) {
    if (!card || !expected.has(card.name) || seen.has(card.name)) {
      return false;
    }
    seen.add(card.name);
    if (!SETTLED_PHASES.has(card.phase)) {
      return false;
    }
  }

  return seen.size === SECTION_ORDER.length;
}
