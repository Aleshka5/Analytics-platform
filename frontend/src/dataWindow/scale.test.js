import { expect, test } from "vitest";
import { MAX_SCALE, MIN_SCALE, stepScale } from "./scale";

test("steps up from 0.5 reach 2 and further steps stay at 2", () => {
  let scale = MIN_SCALE;
  for (let i = 0; i < 15; i += 1) {
    scale = stepScale(scale, 1);
  }
  expect(scale).toBe(MAX_SCALE);
  expect(stepScale(scale, 1)).toBe(MAX_SCALE);
  expect(stepScale(MAX_SCALE, 1)).toBe(2);
});

test("steps down from 2 reach 0.5 and further steps stay at 0.5", () => {
  let scale = MAX_SCALE;
  for (let i = 0; i < 15; i += 1) {
    scale = stepScale(scale, -1);
  }
  expect(scale).toBe(MIN_SCALE);
  expect(stepScale(scale, -1)).toBe(MIN_SCALE);
  expect(stepScale(0.5, -1)).toBe(0.5);
});

test("eleven steps up from 1 land on 2", () => {
  let scale = 1;
  for (let i = 0; i < 11; i += 1) {
    scale = stepScale(scale, 1);
  }
  expect(scale).toBe(2);
});

test("one step up from 1 is 1.1", () => {
  expect(stepScale(1, 1)).toBe(1.1);
});
