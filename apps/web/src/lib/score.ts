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

/** Five discrete band colours, one per `scoreBandKey` — red, orange, yellow,
 * lime, green.
 *
 * Use this anywhere many scores sit side by side (the map's time strip, score
 * chips); use the continuous `scoreColor` only for a single large number
 * where a smooth ramp reads as precision rather than as mush. The continuous
 * ramp is genuinely bad in bulk: real Greek conditions cluster in the 45-75
 * range, which maps to a narrow yellow-to-yellow-green slice, so a week of
 * hourly scores rendered continuously comes out an undifferentiated smear.
 * Snapping to the same five bands the app already names in words ("Meh",
 * "Good", …) makes the strip legible and keeps colour and label in sync. */
export function scoreBandColor(score: number): string {
  switch (scoreBandKey(score)) {
    case "poor":
      return "#f87171";
    case "fair":
      return "#fb923c";
    case "good":
      return "#facc15";
    case "veryGood":
      return "#a3e635";
    case "excellent":
      return "#4ade80";
  }
}

/** Direction-of-influence colours for the factor breakdown's diverging bars.
 * Deliberately only two: there, position already encodes whether a factor
 * helped or hurt, so re-encoding magnitude as hue would just reintroduce the
 * ambiguity the diverging layout exists to remove. */
export const CONTRIBUTION_UP = "#4ade80";
export const CONTRIBUTION_DOWN = "#f87171";

export type ScoreBandKey = "poor" | "fair" | "good" | "veryGood" | "excellent";

// Recalibrated 2026-08-22 alongside the scoring-engine rebalance (see
// PROGRESS.md): after that fix, real conditions still commonly land in the
// 45-62 range, which the old <=69 "good" cutoff swallowed whole — a
// thoroughly unremarkable day was reading as "Good." "good" now requires
// clearing a real above-average bar; the band below it is relabelled
// "Meh" (dictionary.ts) rather than the softer "Fair," since that's the
// whole point — the app should be willing to say a day is nothing special.
export function scoreBandKey(score: number): ScoreBandKey {
  if (score <= 44) return "poor";
  if (score <= 62) return "fair";
  if (score <= 76) return "good";
  if (score <= 88) return "veryGood";
  return "excellent";
}
