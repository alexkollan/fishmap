import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { AREA_GRID_STEP, buildAreaGrid } from "../lib/areaGrid.js";
import { GREECE_BBOX } from "../lib/bbox.js";

interface CacheRow {
  payload: string;
}

// Hoisted once — this route runs these lookups per grid cell per request
// (up to ~352 cells), so reusing prepared statements is worth it here.
const getForecastStmt = db.prepare(
  `SELECT payload FROM weather_cache WHERE grid_lat = ? AND grid_lon = ? AND variable_set = 'area_forecast'`,
);
const getMarineStmt = db.prepare(
  `SELECT payload FROM weather_cache WHERE grid_lat = ? AND grid_lon = ? AND variable_set = 'area_marine'`,
);

interface RawHourly {
  hourly: {
    time: string[];
    [variable: string]: string[] | (number | null)[];
  };
}

/** Same "last hour <= now" convention apps/web's useConditions.ts's
 * findNowIndex uses — no shared helper exists across the API/web boundary,
 * this is a small enough rule to duplicate rather than share. */
function findNowIndex(times: string[]): number {
  const nowMs = Date.now();
  let index = 0;
  for (let i = 0; i < times.length; i++) {
    if (new Date(times[i]!).getTime() <= nowMs) index = i;
    else break;
  }
  return index;
}

function valueAt(hourly: RawHourly["hourly"], variable: string, index: number): number | null {
  const series = hourly[variable];
  if (!series) return null;
  const v = series[index];
  return typeof v === "number" ? v : null;
}

export async function fieldRoutes(app: FastifyInstance) {
  // Purely visual wind/current/pressure map layer, unrelated to scoring
  // (packages/scoring's factors never read from this). Only ever reads the
  // cache the refresh cron (jobs/vectorFieldRefresh.ts) already populated —
  // never calls Open-Meteo itself, same principle as every other read route
  // in this app: the thing that's expensive stays in the background job.
  app.get("/api/fields/area", async (_req, reply) => {
    const { nx, ny, cells } = buildAreaGrid();

    let hourTs: string | null = null;
    const windSpeed: (number | null)[] = [];
    const windDirection: (number | null)[] = [];
    const pressure: (number | null)[] = [];
    const currentSpeed: (number | null)[] = [];
    const currentDirection: (number | null)[] = [];

    for (const cell of cells) {
      const forecastRow = getForecastStmt.get(cell.gridLat, cell.gridLon) as CacheRow | undefined;
      if (!forecastRow) {
        windSpeed.push(null);
        windDirection.push(null);
        pressure.push(null);
        currentSpeed.push(null);
        currentDirection.push(null);
        continue;
      }

      const forecast = JSON.parse(forecastRow.payload) as RawHourly;
      const index = findNowIndex(forecast.hourly.time);
      if (!hourTs) hourTs = forecast.hourly.time[index] ?? null;

      windSpeed.push(valueAt(forecast.hourly, "wind_speed_10m", index));
      windDirection.push(valueAt(forecast.hourly, "wind_direction_10m", index));
      pressure.push(valueAt(forecast.hourly, "pressure_msl", index));

      // Marine coverage thins in enclosed gulfs and is naturally absent over
      // land (DEV_PLAN.md §11.3) — a missing row here just means this cell
      // has no current data, not an error; the client skips it.
      const marineRow = getMarineStmt.get(cell.gridLat, cell.gridLon) as CacheRow | undefined;
      if (marineRow) {
        const marine = JSON.parse(marineRow.payload) as RawHourly;
        const marineIndex = findNowIndex(marine.hourly.time);
        currentSpeed.push(valueAt(marine.hourly, "ocean_current_velocity", marineIndex));
        currentDirection.push(valueAt(marine.hourly, "ocean_current_direction", marineIndex));
      } else {
        currentSpeed.push(null);
        currentDirection.push(null);
      }
    }

    if (!hourTs) {
      reply.code(503);
      return { error: "Vector field grid not ready yet — the refresh job hasn't populated the cache." };
    }

    return {
      step: AREA_GRID_STEP,
      bbox: [GREECE_BBOX.minLon, GREECE_BBOX.minLat, GREECE_BBOX.maxLon, GREECE_BBOX.maxLat],
      nx,
      ny,
      hourTs,
      wind: { speed: windSpeed, direction: windDirection },
      pressure,
      current: { speed: currentSpeed, direction: currentDirection },
    };
  });
}
