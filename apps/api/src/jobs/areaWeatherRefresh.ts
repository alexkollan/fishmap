import { fetchForecastBatch, fetchMarineBatch, type OpenMeteoHourlyResponse } from "../adapters/open-meteo.js";
import { cachedBatch } from "../db/cache.js";
import { buildAreaGrid } from "../lib/areaGrid.js";

// Same per-request ceiling the live /api/weather/grid route enforces
// (apps/api/src/routes/weather.ts's MAX_GRID_POINTS=120) — stay comfortably
// under it since this job drives the batching itself, not a client.
const BATCH_SIZE = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Paced deliberately: firing every batch back to back with no delay blew
// straight through Open-Meteo's per-minute rate limit in testing (most
// batches came back 429/503 and got silently skipped by cachedBatch). This
// keeps the whole ~79-batch run around 3-4 minutes, comfortably under it —
// fine for a job that only needs to finish within its 12h window.
const BATCH_DELAY_MS = 2000;

/**
 * Precomputes the map's full-viewport factor-layer data (DEV_PLAN.md §5.2
 * extended for the area heatmap): fetches the whole Greek bbox at the finer
 * AREA_GRID_STEP on a schedule and lands it in the same `weather_cache`
 * table the point/coastline endpoints use — GET /api/scores/area then only
 * ever reads from cache, never calls upstream, which is what keeps that
 * route fast enough to hit on every hour-scrub.
 *
 * ttlMs=0 passed to cachedBatch means "never fresh enough" — every cell is
 * treated as a miss and refetched on every run, since freshness here is
 * controlled by the cron schedule, not lazy TTL expiry.
 */
export async function refreshAreaWeatherGrid(): Promise<void> {
  const { cells } = buildAreaGrid();
  const batches = chunk(cells, BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]!;
    await cachedBatch<OpenMeteoHourlyResponse>(batch, "forecast", 0, (misses) =>
      fetchForecastBatch(misses.map((m) => ({ lat: m.gridLat, lon: m.gridLon }))),
    );
    await cachedBatch<OpenMeteoHourlyResponse>(batch, "marine", 0, (misses) =>
      fetchMarineBatch(misses.map((m) => ({ lat: m.gridLat, lon: m.gridLon }))),
    ).catch(() => {
      // Marine coverage thins in enclosed gulfs (DEV_PLAN.md §11.3) — a
      // batch failing here still leaves forecast-only data cached for it.
    });
    if (i < batches.length - 1) await sleep(BATCH_DELAY_MS);
  }
}
