import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { tileToMercatorBbox } from "../lib/webMercator.js";

// EMODnet WMS is slow and rate-limited (DEV_PLAN.md §3.4, §5.5) — the
// browser must never call it directly. This proxies XYZ tile requests to a
// WMS GetMap call and caches the PNG on disk for 30 days (bathymetry and
// habitat maps don't change day to day).
const TILE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TILE_SIZE = 256;

const SOURCES: Record<string, { base: string; layers: string }> = {
  bathymetry: { base: "https://ows.emodnet-bathymetry.eu/wms", layers: "emodnet:mean_atlas_land" },
  habitat: {
    base: "https://ows.emodnet-seabedhabitats.eu/geoserver/emodnet_view/wms",
    layers: "greek_seagrass_meadows_v0906",
  },
};

function wmsUrl(base: string, layers: string, bbox: [number, number, number, number]): string {
  const qs = new URLSearchParams({
    service: "WMS",
    version: "1.1.1",
    request: "GetMap",
    layers,
    bbox: bbox.join(","),
    width: String(TILE_SIZE),
    height: String(TILE_SIZE),
    srs: "EPSG:3857",
    format: "image/png",
    transparent: "true",
  });
  return `${base}?${qs.toString()}`;
}

export async function tileRoutes(app: FastifyInstance) {
  const cacheDir = path.resolve(process.env.DATA_DIR ?? path.resolve(process.cwd(), "data"), "tiles");

  app.get("/api/tiles/:source/:z/:x/:y.png", async (req, reply) => {
    const { source, z, x, y } = req.params as Record<string, string>;
    if (!source || !z || !x || !y) {
      reply.code(400);
      return { error: "Missing tile parameters" };
    }
    const def = SOURCES[source];
    if (!def) {
      reply.code(404);
      return { error: "Unknown tile source" };
    }
    const zNum = Number(z);
    const xNum = Number(x);
    const yNum = Number(y);
    if (!Number.isInteger(zNum) || !Number.isInteger(xNum) || !Number.isInteger(yNum)) {
      reply.code(400);
      return { error: "Invalid tile coordinates" };
    }

    const filePath = path.join(cacheDir, source, String(zNum), String(xNum), `${yNum}.png`);

    try {
      const stats = await stat(filePath);
      if (Date.now() - stats.mtimeMs < TILE_TTL_MS) {
        const cached = await readFile(filePath);
        reply.header("Cache-Control", "public, max-age=2592000, immutable");
        reply.type("image/png");
        return cached;
      }
    } catch {
      // not cached yet
    }

    try {
      const bbox = tileToMercatorBbox(zNum, xNum, yNum);
      const res = await fetch(wmsUrl(def.base, def.layers, bbox));
      if (!res.ok) throw new Error(`WMS request failed: ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());

      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, buffer);

      reply.header("Cache-Control", "public, max-age=2592000, immutable");
      reply.type("image/png");
      return buffer;
    } catch (err) {
      req.log.warn(err, `tile proxy failed for ${source}/${z}/${x}/${y}`);
      // Serve stale cache rather than a broken tile if we have one at all.
      try {
        const stale = await readFile(filePath);
        reply.type("image/png");
        return stale;
      } catch {
        reply.code(502);
        return { error: "Tile temporarily unavailable" };
      }
    }
  });
}
