// Coastline scoring worker (DEV_PLAN.md §5.2, §5.6): the only place in the
// app that scores more than one point at a time, so it's the only place
// that needs to keep the main thread free. Scrubbing the time slider is
// zero network requests (the fetched series is already here) and one pass
// through this worker.
import { DEFAULT_WEIGHT_PROFILES, getSunMoonData, scoreHour } from "@fishmap/scoring";
import type { Mode, SunMoonData, WeightProfile } from "@fishmap/types";
import type { FromWorkerMessage, GridSeriesEntry, SegmentInput, ToWorkerMessage } from "./workerTypes";

// Bounds the sparkline's cost: it scores every hour (~216) instead of just
// the current one, so it runs against a sample of segments rather than all
// ~9000 — a few hundred is plenty to represent a viewport's trend.
const SPARKLINE_SAMPLE_SIZE = 150;

let segments: SegmentInput[] = [];
const gridData = new Map<string, GridSeriesEntry["series"]>();
const sunMoonCache = new Map<string, SunMoonData>();
// Admin-editable overrides (DEV_PLAN.md §8) — falls back to the hardcoded
// defaults until the main thread posts resolved profiles from /api/weights.
let weightProfiles: Record<Mode, WeightProfile> = DEFAULT_WEIGHT_PROFILES;

function sunMoonFor(gridKey: string, series: GridSeriesEntry["series"], hourTime: string): SunMoonData {
  const cacheKey = `${gridKey}|${hourTime.slice(0, 10)}`;
  let sunMoon = sunMoonCache.get(cacheKey);
  if (!sunMoon) {
    sunMoon = getSunMoonData(new Date(hourTime), series.latitude, series.longitude);
    sunMoonCache.set(cacheKey, sunMoon);
  }
  return sunMoon;
}

function sampleEvenly<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  const step = items.length / n;
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    const item = items[Math.floor(i * step)];
    if (item) out.push(item);
  }
  return out;
}

self.onmessage = (event: MessageEvent<ToWorkerMessage>) => {
  const msg = event.data;

  if (msg.type === "segments") {
    segments = msg.segments;
    return;
  }

  if (msg.type === "gridData") {
    for (const entry of msg.entries) gridData.set(entry.gridKey, entry.series);
    return;
  }

  if (msg.type === "weights") {
    weightProfiles = msg.profiles;
    return;
  }

  if (msg.type === "score") {
    const profile = weightProfiles[msg.mode];
    const ids: number[] = [];
    const overall: number[] = [];
    const factors: Record<string, number[]> = {};

    for (const seg of segments) {
      const series = gridData.get(seg.gridKey);
      const hour = series?.hourly[msg.hourIndex];
      if (!series || !hour) continue;

      const sunMoon = sunMoonFor(seg.gridKey, series, hour.time);
      const result = scoreHour(series.hourly, msg.hourIndex, sunMoon, msg.mode, profile, seg.aspectDeg);
      ids.push(seg.id);
      overall.push(result.score);
      for (const f of result.factors) {
        (factors[f.key] ??= []).push(f.score);
      }
    }

    // sunMoonCache would otherwise grow unbounded across many scrubs+pans.
    if (sunMoonCache.size > 1000) sunMoonCache.clear();

    const response: FromWorkerMessage = { type: "scores", ids, overall, factors, hourIndex: msg.hourIndex };
    (self as unknown as Worker).postMessage(response);
    return;
  }

  if (msg.type === "sparkline") {
    const profile = weightProfiles[msg.mode];
    const withData = sampleEvenly(
      segments.filter((s) => gridData.has(s.gridKey)),
      SPARKLINE_SAMPLE_SIZE,
    );

    const hourCount = withData.length > 0 ? (gridData.get(withData[0]!.gridKey)?.hourly.length ?? 0) : 0;
    const values: (number | null)[] = new Array(hourCount).fill(null);

    for (let h = 0; h < hourCount; h++) {
      let sum = 0;
      let count = 0;
      for (const seg of withData) {
        const series = gridData.get(seg.gridKey);
        const hour = series?.hourly[h];
        if (!series || !hour) continue;
        const sunMoon = sunMoonFor(seg.gridKey, series, hour.time);
        const result = scoreHour(series.hourly, h, sunMoon, msg.mode, profile, seg.aspectDeg);
        sum += result.score;
        count++;
      }
      values[h] = count > 0 ? Math.round(sum / count) : null;
    }

    const response: FromWorkerMessage = { type: "sparkline", values };
    (self as unknown as Worker).postMessage(response);
  }
};
