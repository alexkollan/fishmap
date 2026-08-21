import type { Mode, WeatherSeries, WeightProfile } from "@fishmap/types";

export interface SegmentInput {
  id: number;
  aspectDeg: number;
  gridKey: string;
}

export interface GridSeriesEntry {
  gridKey: string;
  series: WeatherSeries;
}

export type ToWorkerMessage =
  | { type: "segments"; segments: SegmentInput[] }
  | { type: "gridData"; entries: GridSeriesEntry[] }
  | { type: "weights"; profiles: Record<Mode, WeightProfile> }
  | { type: "score"; hourIndex: number; mode: Mode }
  | { type: "sparkline"; mode: Mode };

/** Per-factor scores ride along with every "scores" message (DEV_PLAN.md
 * §6.4 score layers) — computing them is free, they're already inside each
 * segment's ScoreResult, so switching the visible layer client-side never
 * needs a second worker round trip. */
export type FromWorkerMessage =
  | { type: "scores"; ids: number[]; overall: number[]; factors: Record<string, number[]>; hourIndex: number }
  | { type: "sparkline"; values: (number | null)[] };

export function gridKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}
