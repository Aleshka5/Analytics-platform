export const MIN_SCALE = 0.5;
export const MAX_SCALE = 2;
export const SCALE_STEP = 0.1;

/** Clamp to [0.5, 2] and snap to the nearest tenth so 0.1 steps do not drift. */
export function clampScale(value) {
  const tenths = Math.round(value * 10);
  const clamped = Math.min(MAX_SCALE * 10, Math.max(MIN_SCALE * 10, tenths));
  return clamped / 10;
}

export function stepScale(current, direction) {
  return clampScale(current + direction * SCALE_STEP);
}
