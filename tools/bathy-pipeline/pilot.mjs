// Measurement spike, not part of the build. Contours one chunk of real
// coastline and reports output size so the full-Greece sweep can be costed
// before it's run. Greek coastline is extremely convoluted (thousands of
// islands), so contour geometry volume is the main feasibility risk here.
import { contours } from "d3-contour";
import { fetchCoverage, gridToLonLat, roundCoord, simplifyRing } from "./lib.mjs";

const LEVELS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 4000];

// A deliberately awkward chunk: Kea / Kythnos / Lavrio, lots of islands and
// broken coast, so this over- rather than under-estimates.
const BOX = { minLat: 37.4, maxLat: 37.9, minLon: 23.9, maxLon: 24.6 };

const t0 = Date.now();
const grid = await fetchCoverage(BOX.minLat, BOX.minLon, BOX.maxLat, BOX.maxLon);
console.log(`fetched ${grid.width}x${grid.height} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// d3-contour thresholds on "value >= t"; depth is negative elevation, so
// flip the sign and contour on positive metres-below-sea-level.
const depth = new Float64Array(grid.values.length);
for (let i = 0; i < grid.values.length; i++) {
  const v = grid.values[i];
  depth[i] = Number.isFinite(v) ? -v : -9999;
}

const toLonLat = gridToLonLat(BOX.minLon, BOX.maxLat);
const generator = contours().size([grid.width, grid.height]).thresholds(LEVELS);
const result = generator(depth);

for (const tol of [0, 0.0003, 0.0005, 0.001]) {
  const features = [];
  let vertsBefore = 0;
  let vertsAfter = 0;
  let dropped = 0;
  for (const c of result) {
    for (const polygon of c.coordinates) {
      for (const ring of polygon) {
        vertsBefore += ring.length;
        const lonlat = ring.map(([x, y]) => toLonLat(x, y));
        const simplified = tol > 0 ? simplifyRing(lonlat, tol) : lonlat;
        // Keep anything that still draws as a line. A 3-point ring is a rock
        // or islet's contour, which is precisely the feature a shore
        // fisherman cares about — only genuinely degenerate output is cut.
        if (simplified.length < 3) {
          dropped++;
          continue;
        }
        vertsAfter += simplified.length;
        features.push({
          type: "Feature",
          properties: { depth: c.value },
          geometry: { type: "LineString", coordinates: simplified.map(([a, b]) => [roundCoord(a), roundCoord(b)]) },
        });
      }
    }
  }
  const json = JSON.stringify({ type: "FeatureCollection", features });
  const gz = (await import("node:zlib")).gzipSync(Buffer.from(json)).length;
  console.log(
    `tol ${String(tol).padEnd(7)} features ${String(features.length).padStart(5)} (dropped ${dropped})  verts ${vertsBefore}->${vertsAfter}  ` +
      `json ${(json.length / 1024).toFixed(0)} KB  gzip ${(gz / 1024).toFixed(0)} KB`,
  );
}

const byDepth = new Map();
for (const c of result) byDepth.set(c.value, c.coordinates.length);
console.log("\nrings per depth level:", [...byDepth.entries()].map(([d, n]) => `${d}m:${n}`).join("  "));

const areaDeg = (BOX.maxLat - BOX.minLat) * (BOX.maxLon - BOX.minLon);
const greeceDeg = (41.8 - 34.5) * (29.7 - 19.2);
console.log(`\nthis chunk is ${areaDeg.toFixed(2)} deg^2; Greek bbox is ${greeceDeg.toFixed(0)} deg^2 (${(greeceDeg / areaDeg).toFixed(0)}x)`);
console.log("note: most of the Greek bbox is open sea or land with no shallow contours, so a linear scale-up is a worst case");
