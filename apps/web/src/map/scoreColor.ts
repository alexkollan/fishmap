// Same 3-stop ramp as the coastline line layer's paint expression
// (useCoastlineScoring.ts's "line-color" interpolate) — kept in sync by
// hand since one's a MapLibre style expression and the other is plain JS
// for the area-heatmap worker's canvas pixels.
const STOPS: [number, [number, number, number]][] = [
  [0, [248, 113, 113]], // #f87171
  [50, [250, 204, 21]], // #facc15
  [100, [74, 222, 128]], // #4ade80
];

export function scoreToColor(score: number): [number, number, number] {
  const s = Math.max(0, Math.min(100, score));
  const [lo, hi] = s <= 50 ? [STOPS[0]!, STOPS[1]!] : [STOPS[1]!, STOPS[2]!];
  const t = s <= 50 ? s / 50 : (s - 50) / 50;
  return [
    Math.round(lo[1][0] + (hi[1][0] - lo[1][0]) * t),
    Math.round(lo[1][1] + (hi[1][1] - lo[1][1]) * t),
    Math.round(lo[1][2] + (hi[1][2] - lo[1][2]) * t),
  ];
}
