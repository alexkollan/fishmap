import type { FastifyInstance } from "fastify";
import {
  fetchForecast,
  fetchForecastBatch,
  fetchMarine,
  fetchMarineBatch,
  type OpenMeteoHourlyResponse,
} from "../adapters/open-meteo.js";
import { mergeToSeries } from "../adapters/merge.js";
import { cached, cachedBatch } from "../db/cache.js";
import { snapToGrid } from "../lib/grid.js";

const ATMOSPHERIC_TTL_MS = 60 * 60 * 1000; // 60 min, DEV_PLAN.md §5.5
const MARINE_TTL_MS = 3 * 60 * 60 * 1000; // 3 h

// One HTTP call can legitimately need every grid cell touching the Greek
// coastline (~410 at 0.25°, see tools/coastline-pipeline) — but a single
// upstream request that large gets slow and heavy. Cap it; the client
// chunks a full-Greece viewport into a few calls under this limit instead.
const MAX_GRID_POINTS = 120;

export async function weatherRoutes(app: FastifyInstance) {
  app.get("/api/weather", async (req, reply) => {
    const query = req.query as Record<string, string | undefined>;
    const lat = Number(query.lat);
    const lon = Number(query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      reply.code(400);
      return { error: "lat and lon query params are required numbers" };
    }

    const gridLat = snapToGrid(lat);
    const gridLon = snapToGrid(lon);

    let forecastResult;
    try {
      forecastResult = await cached(gridLat, gridLon, "forecast", ATMOSPHERIC_TTL_MS, () =>
        fetchForecast(gridLat, gridLon),
      );
    } catch (err) {
      req.log.error(err, "forecast fetch failed with no cache to fall back on");
      reply.code(502);
      return { error: "Weather data temporarily unavailable" };
    }

    // Marine coverage thins in enclosed gulfs (DEV_PLAN.md §11.3) — a failure
    // here degrades to atmospheric-only scoring rather than failing the request.
    const marineResult = await cached(gridLat, gridLon, "marine", MARINE_TTL_MS, () =>
      fetchMarine(gridLat, gridLon),
    ).catch((err) => {
      req.log.warn(err, "marine fetch unavailable, continuing atmospheric-only");
      return null;
    });

    return mergeToSeries(forecastResult.data, marineResult?.data ?? null, gridLat, gridLon);
  });

  // Map viewport fetch (DEV_PLAN.md §5.2): one batched call per distinct set
  // of 0.25° grid cells instead of one call per coastline segment.
  app.get("/api/weather/grid", async (req, reply) => {
    const query = req.query as Record<string, string | undefined>;
    const raw = query.points ?? "";
    const pairs = raw
      .split(";")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const [latStr, lonStr] = p.split(",");
        return { lat: Number(latStr), lon: Number(lonStr) };
      })
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

    if (pairs.length === 0) {
      reply.code(400);
      return { error: "points query param required, format lat,lon;lat,lon;..." };
    }
    if (pairs.length > MAX_GRID_POINTS) {
      reply.code(400);
      return { error: `Too many points (max ${MAX_GRID_POINTS} per request) — chunk the viewport client-side.` };
    }

    const gridPoints = pairs.map((p) => ({ gridLat: snapToGrid(p.lat), gridLon: snapToGrid(p.lon) }));
    const uniqueByKey = new Map(gridPoints.map((p) => [`${p.gridLat},${p.gridLon}`, p]));
    const uniquePoints = [...uniqueByKey.values()];

    const forecastMap = await cachedBatch<OpenMeteoHourlyResponse>(uniquePoints, "forecast", ATMOSPHERIC_TTL_MS, (misses) =>
      fetchForecastBatch(misses.map((m) => ({ lat: m.gridLat, lon: m.gridLon }))),
    );
    const marineMap = await cachedBatch<OpenMeteoHourlyResponse>(uniquePoints, "marine", MARINE_TTL_MS, (misses) =>
      fetchMarineBatch(misses.map((m) => ({ lat: m.gridLat, lon: m.gridLon }))),
    ).catch((err) => {
      req.log.warn(err, "marine grid batch unavailable, continuing atmospheric-only");
      return new Map<string, { data: OpenMeteoHourlyResponse; stale: boolean }>();
    });

    const series = uniquePoints
      .map((p) => {
        const key = `${p.gridLat},${p.gridLon}`;
        const forecast = forecastMap.get(key);
        if (!forecast) return null;
        const marine = marineMap.get(key);
        return mergeToSeries(forecast.data, marine?.data ?? null, p.gridLat, p.gridLon);
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    return { points: series };
  });
}
