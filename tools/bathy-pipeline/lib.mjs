// Shared helpers for the bathymetry contour pipeline. Kept separate from
// build.mjs so the pilot/measurement script can reuse them without running a
// full Greece sweep.

const WCS = "https://ows.emodnet-bathymetry.eu/wcs";

/** EMODnet's mean-depth DTM: EPSG:4326, 1/960° cells (~115 m). Values are
 * elevation, so the sea is *negative* and land is positive. */
export const CELL_DEG = 1 / 960;

/**
 * Reader for the GeoTIFF EMODnet's WCS returns. Deliberately minimal rather
 * than a `geotiff` dependency: the response is a single uncompressed,
 * single-tile, big-endian float32 image, which is a handful of tags. If
 * EMODnet ever starts returning compressed or multi-tile output this will
 * throw loudly rather than silently misread — hence the explicit checks.
 */
export function readGeoTiff(buf) {
  const be = buf.toString("ascii", 0, 2) === "MM";
  if (!be && buf.toString("ascii", 0, 2) !== "II") throw new Error("not a TIFF");
  const u16 = (o) => (be ? buf.readUInt16BE(o) : buf.readUInt16LE(o));
  const u32 = (o) => (be ? buf.readUInt32BE(o) : buf.readUInt32LE(o));
  const f32 = (o) => (be ? buf.readFloatBE(o) : buf.readFloatLE(o));

  const ifd = u32(4);
  const count = u16(ifd);
  const tags = new Map();
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    const tag = u16(e);
    const type = u16(e + 2);
    const n = u32(e + 4);
    tags.set(tag, { type, n, offset: e + 8, value: type === 3 && n === 1 ? u16(e + 8) : u32(e + 8) });
  }
  const get = (t) => tags.get(t)?.value;
  /** LONG arrays live inline when they fit in the 4-byte value slot, and at
   * the pointed-to offset otherwise. */
  const longArray = (tag) => {
    const t = tags.get(tag);
    if (!t) return null;
    if (t.n === 1) return [t.value];
    const base = t.value;
    return Array.from({ length: t.n }, (_, i) => u32(base + i * 4));
  };

  const width = get(256);
  const height = get(257);
  if (get(258) !== 32 || get(339) !== 3) throw new Error("expected 32-bit float samples");
  if (get(259) !== 1) throw new Error("expected uncompressed data");

  const values = new Float32Array(width * height);

  const tileWidth = get(322);
  const tileLength = get(323);
  if (tileWidth && tileLength) {
    // Tiled layout: fixed-size tiles in row-major order, padded past the
    // image edge. EMODnet returns this for anything beyond a small request.
    const offsets = longArray(324);
    const across = Math.ceil(width / tileWidth);
    const down = Math.ceil(height / tileLength);
    if (offsets.length !== across * down) {
      throw new Error(`tile count mismatch: ${offsets.length} offsets, expected ${across * down}`);
    }
    for (let ty = 0; ty < down; ty++) {
      for (let tx = 0; tx < across; tx++) {
        const base = offsets[ty * across + tx];
        for (let row = 0; row < tileLength; row++) {
          const y = ty * tileLength + row;
          if (y >= height) break;
          for (let col = 0; col < tileWidth; col++) {
            const x = tx * tileWidth + col;
            if (x >= width) continue;
            values[y * width + x] = f32(base + (row * tileWidth + col) * 4);
          }
        }
      }
    }
    return { width, height, values };
  }

  // Strip layout fallback.
  const stripOffsets = longArray(273);
  const rowsPerStrip = get(278) ?? height;
  if (!stripOffsets) throw new Error("TIFF has neither tiles nor strips");
  for (let s = 0; s < stripOffsets.length; s++) {
    const base = stripOffsets[s];
    const firstRow = s * rowsPerStrip;
    for (let row = 0; row < rowsPerStrip; row++) {
      const y = firstRow + row;
      if (y >= height) break;
      for (let x = 0; x < width; x++) {
        values[y * width + x] = f32(base + (row * width + x) * 4);
      }
    }
  }
  return { width, height, values };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** EMODnet's WCS throws transient 502/503s under sustained use — seen
 * immediately during development, not hypothetical. A full Greek sweep is
 * hundreds of requests, so every caller gets backoff rather than losing a
 * long run to one blip. */
export async function fetchCoverage(minLat, minLon, maxLat, maxLon, { timeoutMs = 120_000, retries = 5 } = {}) {
  const qs = new URLSearchParams({
    service: "WCS",
    version: "2.0.1",
    request: "GetCoverage",
    coverageId: "emodnet__mean",
    format: "image/tiff",
  });
  // WCS 2.0 takes repeated `subset` params; URLSearchParams can't express
  // duplicate keys through the object form, so append them.
  qs.append("subset", `Lat(${minLat},${maxLat})`);
  qs.append("subset", `Long(${minLon},${maxLon})`);
  const url = `${WCS}?${qs.toString()}`;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return readGeoTiff(Buffer.from(await res.arrayBuffer()));
      if (res.status !== 502 && res.status !== 503 && res.status !== 429) {
        throw new Error(`WCS ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }
      lastError = new Error(`WCS ${res.status}`);
    } catch (err) {
      lastError = err;
      if (err instanceof Error && err.message.startsWith("WCS 4") && !err.message.startsWith("WCS 429")) throw err;
    }
    if (attempt < retries) await sleep(2000 * 2 ** attempt);
  }
  throw lastError;
}

/** Row 0 of the returned grid is the *northern* edge (negative y offset in
 * the geotransform), so grid y maps to descending latitude. */
export function gridToLonLat(minLon, maxLat, width, height) {
  const lonStep = CELL_DEG;
  const latStep = CELL_DEG;
  return (x, y) => [minLon + x * lonStep, maxLat - y * latStep];
}

/** Douglas-Peucker on a lon/lat ring, tolerance in degrees. Contours come out
 * of marching squares at one vertex per cell edge, which is far more
 * precision than any display zoom needs and dominates the output size. */
export function simplifyRing(points, tolerance) {
  if (points.length < 3) return points;
  const sqTol = tolerance * tolerance;

  function sqSegDist(p, a, b) {
    let [x, y] = a;
    let dx = b[0] - x;
    let dy = b[1] - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = b[0];
        y = b[1];
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }
    dx = p[0] - x;
    dy = p[1] - y;
    return dx * dx + dy * dy;
  }

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDist = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = sqSegDist(points[i], points[first], points[last]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist > sqTol && index > 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** 4 decimals is ~11 m, which is still 3x finer than the simplification
 * tolerance and far finer than the 115 m source grid. 5 decimals was
 * shipping ~1 m precision the data does not have, for ~20% more bytes. */
export function roundCoord(v, decimals = 4) {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}
