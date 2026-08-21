import type { FastifyInstance } from "fastify";
import { fetchForecast, fetchMarine } from "../adapters/open-meteo.js";
import { mergeToSeries } from "../adapters/merge.js";
import { cached } from "../db/cache.js";
import { snapToGrid } from "../lib/grid.js";

const ATMOSPHERIC_TTL_MS = 60 * 60 * 1000; // 60 min, DEV_PLAN.md §5.5
const MARINE_TTL_MS = 3 * 60 * 60 * 1000; // 3 h

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
}
