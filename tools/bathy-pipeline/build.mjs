// Shallow-water depth contours for the Greek coast — the C-MAP-style layer
// EMODnet's own `emodnet:contours` WMS can't provide.
//
// Why this exists: EMODnet publishes ready-made depth contours, but its
// shallowest is **50 m**. Verified directly against the Saronic gulf, which
// is mostly shallower than 100 m and still only ever draws 50/100. That
// leaves the 0-40 m band — the entire range shore fishing and spearfishing
// care about — with no contours at all. So instead of its rendered contour
// tiles we pull the underlying DTM (`emodnet__mean` via WCS, EPSG:4326,
// 1/960 deg ~= 115 m cells, elevation so the sea is negative) and run
// marching squares ourselves at whatever intervals we like.
//
// Output is **polygons, not lines**, one MultiPolygon feature per depth
// level per chunk. MapLibre then renders the same geometry three ways from a
// single source: a blue fill for the depth band, a stroke for the isobath
// itself, and line-placed symbols for the depth numbers. Emitting lines
// instead would have meant shipping the geometry twice to get the fill.
//
// Chunked spatially because the whole Greek bbox is ~11 MB gzipped at this
// tolerance (measured — see pilot.mjs). The client only ever needs the few
// chunks under the viewport.
//
// Run: node build.mjs [--only-chunk lon,lat] [--force]
import { mkdir, writeFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { contours } from "d3-contour";
import { fetchCoverage, gridToLonLat, roundCoord, simplifyRing } from "./lib.mjs";

const GREECE = { minLon: 19, minLat: 34, maxLon: 30, maxLat: 42 };

/** Depth levels in metres below sea level. Dense inshore, where it matters
 * for shore/spear work and where EMODnet gives nothing, then coarser out to
 * the shelf edge. Beyond 200 m is abyss for these purposes — no contour, the
 * basemap just stays dark. */
const LEVELS = [5, 10, 20, 30, 40, 50, 75, 100, 150, 200];

const CHUNK_DEG = 1;

/** ~33 m. One third of a DTM cell, so it never invents precision the source
 * doesn't have, while cutting vertex count ~5x. Measured against a
 * deliberately awkward Cycladic chunk: keeps 399 of 457 rings; the 58 it
 * drops are sub-tolerance specks. */
const SIMPLIFY_TOLERANCE = 0.0003;

const OUT_DIR = path.resolve(process.cwd(), "../../apps/web/public/data/bathy");

const args = process.argv.slice(2);
const force = args.includes("--force");
const onlyArg = args.indexOf("--only-chunk");
const only = onlyArg >= 0 ? args[onlyArg + 1] : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function chunkName(lon, lat) {
  return `${lon}_${lat}.geojson`;
}

async function buildChunk(lon, lat) {
  const grid = await fetchCoverage(lat, lon, lat + CHUNK_DEG, lon + CHUNK_DEG);

  // d3-contour thresholds on "value >= t". Depth is negative elevation, so
  // flip the sign and contour on metres-below-sea-level. Land and nodata go
  // to a large negative so they never fall inside any band.
  const depth = new Float64Array(grid.values.length);
  let seaCells = 0;
  for (let i = 0; i < grid.values.length; i++) {
    const v = grid.values[i];
    if (Number.isFinite(v) && v < 0 && v > -12000) {
      depth[i] = -v;
      seaCells++;
    } else {
      depth[i] = -9999;
    }
  }
  if (seaCells === 0) return null;

  const toLonLat = gridToLonLat(lon, lat + CHUNK_DEG, grid.width, grid.height);
  const result = contours().size([grid.width, grid.height]).thresholds(LEVELS)(depth);

  // A contour that runs off the edge of a chunk gets closed *along that edge*
  // by marching squares. That closure is not a real isobath — stroking it
  // drew a hard white line straight down the map at every 1° boundary,
  // complete with a depth label. Fills don't care (two adjacent bands of the
  // same colour abut seamlessly), so polygons keep the closure and the line
  // geometry is emitted separately with the edge runs cut out.
  const EDGE_EPS = 1e-6;
  const onEdge = ([x, y]) =>
    Math.abs(x - lon) < EDGE_EPS ||
    Math.abs(x - (lon + CHUNK_DEG)) < EDGE_EPS ||
    Math.abs(y - lat) < EDGE_EPS ||
    Math.abs(y - (lat + CHUNK_DEG)) < EDGE_EPS;

  /** Split a closed ring into the runs that aren't lying along a chunk edge. */
  function interiorRuns(coords) {
    const flags = coords.map(onEdge);
    if (!flags.some(Boolean)) return [coords];
    const n = coords.length;
    const runs = [];
    let current = [];
    // Start from an edge vertex so a run can't be split across the wrap.
    const start = flags.indexOf(true);
    for (let k = 0; k <= n; k++) {
      const i = (start + k) % n;
      if (flags[i]) {
        if (current.length >= 2) runs.push(current);
        current = [];
      } else {
        current.push(coords[i]);
      }
    }
    if (current.length >= 2) runs.push(current);
    return runs;
  }

  const features = [];
  for (const c of result) {
    const polygons = [];
    const lines = [];
    for (const polygon of c.coordinates) {
      const rings = [];
      for (const ring of polygon) {
        const simplified = simplifyRing(
          ring.map(([x, y]) => toLonLat(x, y)),
          SIMPLIFY_TOLERANCE,
        );
        if (simplified.length < 3) continue;
        const coords = simplified.map(([a, b]) => [roundCoord(a), roundCoord(b)]);
        // GeoJSON polygons must close; simplification keeps the first and
        // last vertex, but rounding can still separate them.
        const first = coords[0];
        const last = coords[coords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) coords.push([first[0], first[1]]);
        if (coords.length < 4) continue;
        rings.push(coords);
        for (const run of interiorRuns(coords.slice(0, -1))) lines.push(run);
      }
      if (rings.length) polygons.push(rings);
    }
    if (polygons.length) {
      features.push({
        type: "Feature",
        properties: { depth: c.value, kind: "band" },
        geometry: { type: "MultiPolygon", coordinates: polygons },
      });
    }
    if (lines.length) {
      features.push({
        type: "Feature",
        properties: { depth: c.value, kind: "isobath" },
        geometry: { type: "MultiLineString", coordinates: lines },
      });
    }
  }

  if (!features.length) return null;
  return { type: "FeatureCollection", features };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const jobs = [];
  for (let lat = GREECE.minLat; lat < GREECE.maxLat; lat += CHUNK_DEG) {
    for (let lon = GREECE.minLon; lon < GREECE.maxLon; lon += CHUNK_DEG) {
      if (only && only !== `${lon},${lat}`) continue;
      jobs.push([lon, lat]);
    }
  }

  console.log(`${jobs.length} chunks to consider, ${LEVELS.length} levels each`);
  const written = [];
  let skipped = 0;
  let empty = 0;

  for (const [lon, lat] of jobs) {
    const file = path.join(OUT_DIR, chunkName(lon, lat));
    if (!force) {
      try {
        await stat(file);
        written.push({ lon, lat });
        skipped++;
        continue;
      } catch {
        // not built yet
      }
    }

    const label = `${lon},${lat}`;
    try {
      const fc = await buildChunk(lon, lat);
      if (!fc) {
        empty++;
        console.log(`  ${label.padEnd(9)} no sea / no contours`);
      } else {
        const json = JSON.stringify(fc);
        await writeFile(file, json);
        written.push({ lon, lat });
        console.log(`  ${label.padEnd(9)} ${String(fc.features.length).padStart(2)} levels, ${(json.length / 1024).toFixed(0)} KB`);
      }
    } catch (err) {
      console.log(`  ${label.padEnd(9)} FAILED: ${err.message.slice(0, 120)}`);
    }
    // EMODnet's WCS is a shared public service; pace the sweep.
    await sleep(500);
  }

  // Index so the client knows which chunks exist without probing for 404s.
  const index = {
    cellDeg: CHUNK_DEG,
    levels: LEVELS,
    chunks: written.sort((a, b) => a.lat - b.lat || a.lon - b.lon).map(({ lon, lat }) => [lon, lat]),
  };
  await writeFile(path.join(OUT_DIR, "index.json"), JSON.stringify(index));

  const files = await readdir(OUT_DIR);
  let total = 0;
  for (const f of files) total += (await stat(path.join(OUT_DIR, f))).size;
  console.log(`\n${written.length} chunks with data (${skipped} already present, ${empty} empty), ${(total / 1024 / 1024).toFixed(1)} MB on disk`);
}

await main();
