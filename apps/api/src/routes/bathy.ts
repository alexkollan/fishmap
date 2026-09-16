import type { FastifyInstance } from "fastify";

// Where a point's depth data actually came from.
//
// This exists because our depth contours (tools/bathy-pipeline) look far more
// authoritative than the source justifies in places. EMODnet's Greek coverage
// is a patchwork: some areas are real hydrographic survey, some are
// satellite-derived estimates, and a lot of it falls back to GEBCO's ~450 m
// global grid. Rendering all three identically is worse than being uniformly
// coarse, because it invites trust the data hasn't earned. So the spot panel
// says which one you're looking at.
//
// EMODnet's `source_references` layer carries exactly this, one polygon per
// contributing survey, queried via WMS GetFeatureInfo at a point.

const WMS = "https://ows.emodnet-bathymetry.eu/wms";

/** EDMO (European Directory of Marine Organisations) ids seen over Greek
 * waters. Resolving these live would mean a second round-trip per lookup to
 * a directory that effectively never changes, so the handful that actually
 * appear are inlined and anything else falls back to its bare id. */
const ORGANISATIONS: Record<number, string> = {
  145: "CNR — Institute of Marine Science",
  269: "HCMR / HNODC (Greek national)",
  1528: "Deltares",
  4667: "EOMAP",
};

export type BathyQuality = "survey" | "satellite" | "global" | "unknown";

interface SourceInfo {
  quality: BathyQuality;
  organisation: string | null;
  identifier: string | null;
  release: string | null;
}

function classify(identifier: string | null, edmoId: number | null): BathyQuality {
  if (identifier && /gebco/i.test(identifier)) return "global";
  if (edmoId === 4667) return "satellite";
  if (edmoId !== null) return "survey";
  return "unknown";
}

// Static data — a long TTL is fine, and it spares EMODnet a request per pin
// move. Bounded so a bot panning the map can't grow it without limit.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MAX = 2000;
const cache = new Map<string, { at: number; value: SourceInfo }>();

function cacheKey(lat: number, lon: number): string {
  // ~1 km buckets: finer than the underlying survey polygons are anyway.
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

async function fetchSource(lat: number, lon: number): Promise<SourceInfo> {
  // GetFeatureInfo needs a pixel within a bbox rather than a bare coordinate,
  // so build a tiny box around the point and query its centre.
  const d = 0.002;
  const qs = new URLSearchParams({
    service: "WMS",
    version: "1.1.1",
    request: "GetFeatureInfo",
    layers: "emodnet:source_references",
    query_layers: "emodnet:source_references",
    bbox: `${lon - d},${lat - d},${lon + d},${lat + d}`,
    width: "101",
    height: "101",
    srs: "EPSG:4326",
    format: "image/png",
    info_format: "application/json",
    x: "50",
    y: "50",
    feature_count: "1",
  });

  const res = await fetch(`${WMS}?${qs.toString()}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`EMODnet GetFeatureInfo ${res.status}`);
  const json = (await res.json()) as { features?: { properties?: Record<string, unknown> }[] };
  const props = json.features?.[0]?.properties;
  if (!props) return { quality: "global", organisation: null, identifier: null, release: null };

  const edmoId = typeof props.edmo_id === "number" ? props.edmo_id : null;
  const identifier = typeof props.identifier === "string" ? props.identifier : null;
  const release = props.release === null || props.release === undefined ? null : String(props.release);

  return {
    quality: classify(identifier, edmoId),
    organisation: edmoId !== null ? (ORGANISATIONS[edmoId] ?? `EDMO ${edmoId}`) : null,
    identifier,
    release,
  };
}

export async function bathyRoutes(app: FastifyInstance) {
  app.get("/api/bathy/source", async (req, reply) => {
    const { lat, lon } = req.query as Record<string, string | undefined>;
    const latNum = Number(lat);
    const lonNum = Number(lon);
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
      reply.code(400);
      return { error: "lat and lon are required" };
    }

    const key = cacheKey(latNum, lonNum);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      reply.header("Cache-Control", "public, max-age=86400");
      return hit.value;
    }

    try {
      const value = await fetchSource(latNum, lonNum);
      if (cache.size >= CACHE_MAX) cache.clear();
      cache.set(key, { at: Date.now(), value });
      reply.header("Cache-Control", "public, max-age=86400");
      return value;
    } catch (err) {
      req.log.warn(err, "bathy source lookup failed");
      // Not worth failing the panel over — the caller renders nothing.
      reply.header("Cache-Control", "public, max-age=300");
      return { quality: "unknown", organisation: null, identifier: null, release: null } satisfies SourceInfo;
    }
  });
}
