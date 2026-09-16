// Unambiguous georeferencing check, independent of level count.
//
// Walk a constant-latitude transect across the source grid and find, by
// linear interpolation between adjacent cells, the exact longitude where the
// true depth crosses a chosen isobath. Then find where our generated isobath
// for that same depth crosses the same latitude. The difference is the
// pipeline's positional error, in metres.
import { readFileSync } from "node:fs";
import { fetchCoverage, CELL_DEG } from "./lib.mjs";

const CHUNK = "23_37";
const DEPTH = Number(process.argv[2] ?? 20);
const minLat = 37.6, maxLat = 37.72, minLon = 23.9, maxLon = 24.0;

const g = await fetchCoverage(minLat, minLon, maxLat, maxLon);
const fc = JSON.parse(readFileSync(`../../apps/web/public/data/bathy/${CHUNK}.geojson`, "utf8"));
const iso = fc.features.find((f) => f.properties.kind === "isobath" && f.properties.depth === DEPTH);
if (!iso) throw new Error(`no isobath feature for ${DEPTH} m`);

const M_PER_DEG_LAT = 111_320;
const mPerDegLon = (lat) => (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));

/** Where does the raw grid cross `DEPTH` along this row, scanning east? */
function sourceCrossings(row) {
  const lat = maxLat - (row + 0.5) * CELL_DEG; // pixel-centre latitude
  const out = [];
  for (let x = 0; x < g.width - 1; x++) {
    const a = g.values[row * g.width + x];
    const b = g.values[row * g.width + x + 1];
    if (!Number.isFinite(a) || !Number.isFinite(b) || a >= 0 || b >= 0) continue;
    const da = -a, db = -b;
    if ((da - DEPTH) * (db - DEPTH) > 0) continue; // no crossing
    const t = (DEPTH - da) / (db - da);
    out.push(minLon + (x + 0.5 + t) * CELL_DEG);
  }
  return { lat, out };
}

/** Where does our generated isobath cross that same latitude? */
function contourCrossings(lat) {
  const out = [];
  for (const line of iso.geometry.coordinates) {
    for (let i = 0; i < line.length - 1; i++) {
      const [x1, y1] = line[i];
      const [x2, y2] = line[i + 1];
      if ((y1 - lat) * (y2 - lat) > 0) continue;
      if (y1 === y2) continue;
      const t = (lat - y1) / (y2 - y1);
      out.push(x1 + t * (x2 - x1));
    }
  }
  return out.sort((a, b) => a - b);
}

console.log(`isobath ${DEPTH} m — comparing source crossings to generated contour\n`);
const errors = [];
for (let row = 8; row < g.height - 8; row += 7) {
  const { lat, out: src } = sourceCrossings(row);
  if (!src.length) continue;
  const gen = contourCrossings(lat);
  if (!gen.length) continue;
  for (const s of src) {
    let best = null;
    for (const c of gen) if (best === null || Math.abs(c - s) < Math.abs(best - s)) best = c;
    const dx = (best - s) * mPerDegLon(lat);
    if (Math.abs(dx) < 400) errors.push(dx); // ignore unrelated branches
  }
}

errors.sort((a, b) => a - b);
const mean = errors.reduce((a, b) => a + b, 0) / errors.length;
const median = errors[Math.floor(errors.length / 2)];
const absMean = errors.reduce((a, b) => a + Math.abs(b), 0) / errors.length;
console.log(`  ${errors.length} paired crossings`);
console.log(`  signed mean offset : ${mean.toFixed(1)} m  (east is +)`);
console.log(`  signed median      : ${median.toFixed(1)} m`);
console.log(`  mean |error|       : ${absMean.toFixed(1)} m`);
console.log(`  one source cell is  ${(CELL_DEG * mPerDegLon(37.66)).toFixed(0)} m`);
