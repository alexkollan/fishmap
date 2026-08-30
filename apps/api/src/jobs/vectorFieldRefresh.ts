import { fetchForecastBatch, fetchMarineBatch, type OpenMeteoHourlyResponse } from "../adapters/open-meteo.js";
import { cachedBatch } from "../db/cache.js";
import { buildAreaGrid } from "../lib/areaGrid.js";

// Same per-request ceiling the point-grid convention elsewhere in this repo
// uses (100, comfortably under any documented Open-Meteo per-call limit).
const BATCH_SIZE = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Paced deliberately, same lesson learned from the old (now-deleted) area
// score grid: firing every batch back to back with no delay reliably tripped
// Open-Meteo's per-minute rate limit. At AREA_GRID_STEP=0.5 the whole Greek
// bbox is only ~352 cells (22x16) -> 4 batches of <=100 -> 8 total upstream
// calls (forecast + marine per batch), ~8-16s of pacing delay for the whole
// sweep. That's roughly 20x fewer requests than the old 0.1deg/26-variable
// design needed, which is what actually keeps this under the rate limit that
// broke it before, not just a smaller number picked hopefully.
const BATCH_DELAY_MS = 2000;

/**
 * Precomputes the map's wind/current/pressure visual layer (purely
 * decorative, unrelated to scoring — see routes/fields.ts) on a schedule and
 * lands it in the same `weather_cache` table the point-grid endpoints use,
 * under distinct `area_forecast`/`area_marine` variable_set values so it
 * never collides with the single-point cache rows (0.5° grid coordinates are
 * a subset of valid 0.25° point-grid coordinates, and the payloads have a
 * different, narrower variable shape).
 *
 * ttlMs=0 means every cell is treated as a miss and refetched on every run —
 * freshness here is controlled by the cron schedule (every 6h,
 * server.ts), not lazy TTL expiry.
 */
export async function refreshVectorFieldGrid(): Promise<void> {
  const { cells } = buildAreaGrid();
  const batches = chunk(cells, BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]!;
    await cachedBatch<OpenMeteoHourlyResponse>(batch, "area_forecast", 0, (misses) =>
      fetchForecastBatch(misses.map((m) => ({ lat: m.gridLat, lon: m.gridLon }))),
    );
    await cachedBatch<OpenMeteoHourlyResponse>(batch, "area_marine", 0, (misses) =>
      fetchMarineBatch(misses.map((m) => ({ lat: m.gridLat, lon: m.gridLon }))),
    ).catch(() => {
      // Marine coverage thins in enclosed gulfs (DEV_PLAN.md §11.3) — a
      // batch failing here still leaves wind/pressure data cached for it.
    });
    if (i < batches.length - 1) await sleep(BATCH_DELAY_MS);
  }
}
