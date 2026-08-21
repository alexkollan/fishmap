// One-off build: Natural Earth 10m coastline -> Greek-bbox segments with precomputed
// seaward aspect bearing. Output is a static GeoJSON consumed directly by the map
// (no MVT tiling stage — see PROGRESS.md for why tippecanoe isn't in this pipeline).
import { readFileSync, writeFileSync } from "node:fs";
import * as turf from "@turf/turf";

const GREECE_BBOX = [19.2, 34.5, 29.7, 41.8]; // DEV_PLAN.md §1
const PAD_BBOX = [17.5, 33.0, 31.5, 42.5]; // padded, for land features used in aspect testing
const SEGMENT_LENGTH_KM = 1.5;
const OFFSET_M = 250;
const GRID_STEP = 0.25; // must match apps/api/src/lib/grid.ts

function snapToGrid(v) {
  return Math.round(v / GRID_STEP) * GRID_STEP;
}

const RAW_DIR = process.env.COASTLINE_RAW_DIR ?? "/tmp/claude-1000/-mnt-c-Users-kolla-Documents-GitHub-fishmap/0b49a90f-1a10-41e3-b08d-64093cd331f5/scratchpad/coastline";
const OUT_PATH = process.env.COASTLINE_OUT ?? "../../apps/web/public/data/coastline.geojson";

function bboxOf(feature) {
  try {
    return turf.bbox(feature);
  } catch {
    return null;
  }
}

function intersectsBbox(fb, bbox) {
  return !(fb[0] > bbox[2] || fb[2] < bbox[0] || fb[1] > bbox[3] || fb[3] < bbox[1]);
}

console.log("Loading source data...");
const coastlineRaw = JSON.parse(readFileSync(`${RAW_DIR}/ne_10m_coastline.geojson`, "utf8"));
const landRaw = JSON.parse(readFileSync(`${RAW_DIR}/ne_10m_land.geojson`, "utf8"));

console.log(`Source: ${coastlineRaw.features.length} coastline features, ${landRaw.features.length} land features`);

// Pre-filter land polygons to the padded region so point-in-polygon tests stay cheap.
const landFeatures = landRaw.features.filter((f) => {
  const bb = bboxOf(f);
  return bb && intersectsBbox(bb, PAD_BBOX);
});
console.log(`Land features near Greece: ${landFeatures.length}`);

function isLand(pt) {
  for (const land of landFeatures) {
    try {
      if (turf.booleanPointInPolygon(pt, land)) return true;
    } catch {
      // ignore malformed ring, keep scanning
    }
  }
  return false;
}

// 1. Clip coastline lines to the Greek bbox.
const clipBboxPoly = turf.bboxPolygon(GREECE_BBOX);
const clippedLines = [];
for (const feature of coastlineRaw.features) {
  const bb = bboxOf(feature);
  if (!bb || !intersectsBbox(bb, GREECE_BBOX)) continue;
  let clipped;
  try {
    clipped = turf.bboxClip(feature, GREECE_BBOX);
  } catch {
    continue;
  }
  if (!clipped?.geometry) continue;
  if (clipped.geometry.type === "LineString") {
    if (clipped.geometry.coordinates.length >= 2) clippedLines.push(turf.lineString(clipped.geometry.coordinates));
  } else if (clipped.geometry.type === "MultiLineString") {
    for (const coords of clipped.geometry.coordinates) {
      if (coords.length >= 2) clippedLines.push(turf.lineString(coords));
    }
  }
}
console.log(`Clipped to ${clippedLines.length} line parts inside the Greek bbox`);

// 2. Chunk into short segments.
let allSegments = [];
for (const line of clippedLines) {
  const lengthKm = turf.length(line, { units: "kilometers" });
  if (lengthKm < 0.05) continue;
  const chunks = turf.lineChunk(line, SEGMENT_LENGTH_KM, { units: "kilometers" });
  allSegments.push(...chunks.features.filter((f) => f.geometry.coordinates.length >= 2));
}
console.log(`Chunked into ${allSegments.length} segments (~${SEGMENT_LENGTH_KM} km each)`);

// 3. Compute seaward aspect bearing per segment via land-side point-in-polygon test.
let landTests = 0;
const outFeatures = allSegments.map((seg, idx) => {
  const coords = seg.geometry.coordinates;
  const start = coords[0];
  const end = coords[coords.length - 1];
  const centroid = turf.midpoint(turf.point(start), turf.point(end)).geometry.coordinates;
  const tangent = turf.bearing(turf.point(start), turf.point(end));
  const candidateA = ((tangent + 90) % 360 + 360) % 360;
  const candidateB = ((tangent - 90) % 360 + 360) % 360;

  const ptA = turf.destination(turf.point(centroid), OFFSET_M / 1000, candidateA, { units: "kilometers" });
  landTests++;
  const aInLand = isLand(ptA);
  let aspectDeg;
  if (aInLand) {
    aspectDeg = candidateB; // A points inland, sea is the other way
  } else {
    // confirm B does point to land (or at least isn't also sea+land ambiguous); default to A (sea)
    aspectDeg = candidateA;
  }

  return turf.feature(
    seg.geometry,
    {
      id: idx,
      aspectDeg: Math.round(aspectDeg),
      lengthKm: Math.round(turf.length(seg, { units: "kilometers" }) * 100) / 100,
      lat: Math.round(centroid[1] * 10000) / 10000,
      lon: Math.round(centroid[0] * 10000) / 10000,
      // Pre-snapped to the same 0.25° grid the weather API caches on
      // (apps/api/src/lib/grid.ts) so the map can group segments by grid
      // cell without recomputing this client-side.
      gridLat: snapToGrid(centroid[1]),
      gridLon: snapToGrid(centroid[0]),
    },
    { id: idx },
  );
});
console.log(`Computed aspect for ${landTests} segments`);

const fc = turf.featureCollection(outFeatures);
writeFileSync(new URL(OUT_PATH, import.meta.url), JSON.stringify(fc));
console.log(`Wrote ${outFeatures.length} segments to ${OUT_PATH}`);
