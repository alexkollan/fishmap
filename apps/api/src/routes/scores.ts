import type { FastifyInstance } from "fastify";
import { getSunMoonData, scoreHour } from "@fishmap/scoring";
import type { Mode, WeatherHour } from "@fishmap/types";
import { db } from "../db/index.js";
import { mergeToSeries } from "../adapters/merge.js";
import type { OpenMeteoHourlyResponse } from "../adapters/open-meteo.js";
import { AREA_GRID_STEP, buildAreaGrid } from "../lib/areaGrid.js";
import { GREECE_BBOX } from "../lib/bbox.js";

const MODES: Mode[] = ["shore", "boat", "spearfishing"];

// The 7 factors that are actually selectable map layers (LayerDrawer.tsx's
// SCORE_LAYERS minus "overall") — pressure/precipitation/solunar/season stay
// Overall-only, so there's no reason to ship them in this payload.
const FACTOR_KEYS = ["wind", "waves", "pressure", "seaTemp", "turbidity", "current", "light"] as const;
type FactorKey = (typeof FACTOR_KEYS)[number];

interface CacheRow {
  payload: string;
}

// Hoisted once — this route runs these two lookups per grid cell per
// request (up to ~7,800 cells), so reusing prepared statements matters here
// more than it does for the low-volume call sites in db/cache.ts.
const getForecastStmt = db.prepare(
  `SELECT payload FROM weather_cache WHERE grid_lat = ? AND grid_lon = ? AND variable_set = 'forecast'`,
);
const getMarineStmt = db.prepare(
  `SELECT payload FROM weather_cache WHERE grid_lat = ? AND grid_lon = ? AND variable_set = 'marine'`,
);

function readCachedHourly(gridLat: number, gridLon: number): WeatherHour[] | null {
  const forecastRow = getForecastStmt.get(gridLat, gridLon) as CacheRow | undefined;
  if (!forecastRow) return null;
  const marineRow = getMarineStmt.get(gridLat, gridLon) as CacheRow | undefined;

  const forecast = JSON.parse(forecastRow.payload) as OpenMeteoHourlyResponse;
  const marine = marineRow ? (JSON.parse(marineRow.payload) as OpenMeteoHourlyResponse) : null;
  return mergeToSeries(forecast, marine, gridLat, gridLon).hourly;
}

export async function scoreRoutes(app: FastifyInstance) {
  // Full-viewport per-factor grid for the map's "weather map" layers
  // (LayerDrawer.tsx): backed entirely by the area-refresh cron's cache, so
  // this never makes an upstream call — it's meant to be cheap enough to
  // hit on every hour-scrub tick. Overall stays on the live per-segment
  // pipeline (useCoastlineScoring.ts) since it depends on the live-editable
  // weight profile and these per-factor scores don't.
  app.get("/api/scores/area", async (req, reply) => {
    const query = req.query as Record<string, string | undefined>;
    const mode = query.mode as Mode | undefined;
    if (!mode || !MODES.includes(mode)) {
      reply.code(400);
      return { error: `mode must be one of ${MODES.join(", ")}` };
    }

    const hourIndex = Number(query.hourIndex ?? 0);
    if (!Number.isFinite(hourIndex) || hourIndex < 0) {
      reply.code(400);
      return { error: "hourIndex must be a non-negative number" };
    }

    const { nx, ny, cells } = buildAreaGrid();
    const centerLat = (GREECE_BBOX.minLat + GREECE_BBOX.maxLat) / 2;
    const centerLon = (GREECE_BBOX.minLon + GREECE_BBOX.maxLon) / 2;

    // Read every cell once up front. The area-refresh cron fills this cache
    // incrementally (paced to stay under Open-Meteo's rate limit — see
    // jobs/areaWeatherRefresh.ts), so right after a fresh deploy — or if any
    // single cell's fetch keeps failing — most of the grid can be populated
    // while one specific cell isn't. Requiring an exact center cell for the
    // sun/moon reference would 503 the whole endpoint over that; instead use
    // whichever cell happens to have data first (dawn/dusk timing varies by
    // well under an hour across Greece, so any cell is a fine stand-in).
    const hourlyByIndex: (WeatherHour[] | null)[] = cells.map((cell) => readCachedHourly(cell.gridLat, cell.gridLon));
    const referenceHour = hourlyByIndex.map((h) => h?.[hourIndex]).find((h) => h !== undefined);
    if (!referenceHour) {
      reply.code(503);
      return { error: "Area score grid not ready yet — the refresh cron hasn't populated the cache." };
    }
    const sunMoon = getSunMoonData(new Date(referenceHour.time), centerLat, centerLon);

    const factors: Record<FactorKey, (number | null)[]> = {
      wind: [],
      waves: [],
      pressure: [],
      seaTemp: [],
      turbidity: [],
      current: [],
      light: [],
    };

    for (const hourly of hourlyByIndex) {
      const hour = hourly?.[hourIndex];
      if (!hourly || !hour) {
        for (const key of FACTOR_KEYS) factors[key].push(null);
        continue;
      }

      // aspectDeg left undefined: open water has no coastline segment to
      // source a facing direction from, so wind scores by speed alone here,
      // same as single-point pages (packages/scoring's windRelative).
      const result = scoreHour(hourly, hourIndex, sunMoon, mode);
      const byKey = new Map(result.factors.map((f) => [f.key, f.score]));
      for (const key of FACTOR_KEYS) factors[key].push(byKey.get(key) ?? null);
    }

    return {
      step: AREA_GRID_STEP,
      bbox: [GREECE_BBOX.minLon, GREECE_BBOX.minLat, GREECE_BBOX.maxLon, GREECE_BBOX.maxLat],
      nx,
      ny,
      hourTs: referenceHour.time,
      factors,
    };
  });
}
