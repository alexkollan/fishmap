// Mirrors the three score CSS vars in index.css — kept as plain RGB here
// since chart/badge colors need to interpolate numerically, not just apply
// a CSS class (DEV_PLAN.md §11.4: 5-band label as primary, number secondary).
const BAD: [number, number, number] = [248, 113, 113]; // #f87171
const MID: [number, number, number] = [250, 204, 21]; // #facc15
const GOOD: [number, number, number] = [74, 222, 128]; // #4ade80

function mixRgb(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r} ${g} ${bl})`;
}

export function scoreColor(score: number): string {
  const t = Math.max(0, Math.min(100, score)) / 100;
  return t < 0.5 ? mixRgb(BAD, MID, t * 2) : mixRgb(MID, GOOD, (t - 0.5) * 2);
}

export type ScoreBandKey = "poor" | "fair" | "good" | "veryGood" | "excellent";

export function scoreBandKey(score: number): ScoreBandKey {
  if (score <= 29) return "poor";
  if (score <= 49) return "fair";
  if (score <= 69) return "good";
  if (score <= 84) return "veryGood";
  return "excellent";
}
