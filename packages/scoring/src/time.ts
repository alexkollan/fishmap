// Dawn/dusk windows per DEV_PLAN.md §4.6, reused by both the light-window
// scoring factor and the solunar "aligns with twilight" flag so the two
// never drift apart on what counts as "dawn."
const MINUTE_MS = 60_000;

export const DAWN_BEFORE_MIN = 60;
export const DAWN_AFTER_MIN = 90;
export const DUSK_BEFORE_MIN = 90;
export const DUSK_AFTER_MIN = 60;

export function isWithinDawnWindow(t: number, sunriseMs: number): boolean {
  return t >= sunriseMs - DAWN_BEFORE_MIN * MINUTE_MS && t <= sunriseMs + DAWN_AFTER_MIN * MINUTE_MS;
}

export function isWithinDuskWindow(t: number, sunsetMs: number): boolean {
  return t >= sunsetMs - DUSK_BEFORE_MIN * MINUTE_MS && t <= sunsetMs + DUSK_AFTER_MIN * MINUTE_MS;
}

export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}
