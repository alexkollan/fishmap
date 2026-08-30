// Wind/current/pressure map layer data — purely visual, unrelated to scoring
// (packages/scoring never reads this). Source: apps/api/src/routes/fields.ts,
// backed by a coarse (0.5°) precomputed grid over the fixed Greek bbox
// MapCanvas.tsx already restricts panning to (see its maxBounds) — this grid
// covers the whole pannable area, so there's no need to refetch per
// viewport/pan the way a live per-pixel weather map would.

export interface VectorFieldResponse {
  step: number;
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  nx: number;
  ny: number;
  hourTs: string;
  wind: { speed: (number | null)[]; direction: (number | null)[] };
  pressure: (number | null)[];
  current: { speed: (number | null)[]; direction: (number | null)[] };
}

export async function fetchVectorField(): Promise<VectorFieldResponse> {
  const res = await fetch("/api/fields/area", { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load vector field: ${res.status}`);
  return res.json() as Promise<VectorFieldResponse>;
}

/**
 * A sampleable field over the grid: given a lon/lat, bilinearly interpolates
 * a value (or a wind/current vector, decomposed to u/v first since direction
 * degrees can't be linearly interpolated across the 0/360 wrap) from the
 * surrounding 4 grid cells. Cells with `null` (no data — e.g. current over
 * land) are excluded from the interpolation; a point surrounded entirely by
 * nulls returns null.
 */
export class GridField {
  constructor(
    private readonly bbox: [number, number, number, number],
    private readonly nx: number,
    private readonly ny: number,
    private readonly step: number,
  ) {}

  /** Fractional column/row for a lon/lat, or null if outside the grid. */
  private cellCoords(lon: number, lat: number): { fx: number; fy: number } | null {
    const [minLon, minLat, maxLon, maxLat] = this.bbox;
    if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) return null;
    return { fx: (lon - minLon) / this.step, fy: (lat - minLat) / this.step };
  }

  /** Bilinear-interpolate a scalar field (row-major, south-to-north). */
  sampleScalar(values: (number | null)[], lon: number, lat: number): number | null {
    const coords = this.cellCoords(lon, lat);
    if (!coords) return null;
    const { fx, fy } = coords;
    const x0 = Math.max(0, Math.min(this.nx - 1, Math.floor(fx)));
    const y0 = Math.max(0, Math.min(this.ny - 1, Math.floor(fy)));
    const x1 = Math.min(this.nx - 1, x0 + 1);
    const y1 = Math.min(this.ny - 1, y0 + 1);
    const tx = fx - x0;
    const ty = fy - y0;

    const at = (x: number, y: number) => values[y * this.nx + x] ?? null;
    const v00 = at(x0, y0);
    const v10 = at(x1, y0);
    const v01 = at(x0, y1);
    const v11 = at(x1, y1);
    if (v00 === null || v10 === null || v01 === null || v11 === null) {
      // Fall back to nearest non-null corner rather than dropping the point
      // entirely — keeps particle trails from flickering out one cell early
      // near a data boundary (e.g. the coastline for current).
      const nearest = tx < 0.5 ? (ty < 0.5 ? v00 : v01) : ty < 0.5 ? v10 : v11;
      return nearest;
    }

    const top = v00 * (1 - tx) + v10 * tx;
    const bottom = v01 * (1 - tx) + v11 * tx;
    return top * (1 - ty) + bottom * ty;
  }

  /** Bilinear-interpolate a speed+direction (meteorological "from") vector
   * field by decomposing to u/v components first — direction degrees can't
   * be linearly interpolated directly across the 0/360 wrap. */
  sampleVector(
    speed: (number | null)[],
    directionFromDeg: (number | null)[],
    lon: number,
    lat: number,
  ): { u: number; v: number; speed: number } | null {
    const coords = this.cellCoords(lon, lat);
    if (!coords) return null;
    const n = speed.length;
    const u: (number | null)[] = new Array(n);
    const v: (number | null)[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const s = speed[i];
      const d = directionFromDeg[i];
      if (s == null || d == null) {
        u[i] = null;
        v[i] = null;
        continue;
      }
      // "From" convention: velocity points opposite the from-bearing.
      const rad = ((d + 180) % 360) * (Math.PI / 180);
      u[i] = s * Math.sin(rad);
      v[i] = s * Math.cos(rad);
    }
    const su = this.sampleScalar(u, lon, lat);
    const sv = this.sampleScalar(v, lon, lat);
    if (su === null || sv === null) return null;
    return { u: su, v: sv, speed: Math.hypot(su, sv) };
  }
}

/** Ocean current uses the oceanographic "to" convention (opposite of wind's
 * meteorological "from") — see packages/scoring/src/factors.ts's §4.10
 * comment for the same distinction in the scoring context. Convert to a
 * "from" bearing first so sampleVector's decomposition (shared with wind)
 * stays correct for both fields. */
export function currentToFromBearing(toDeg: number): number {
  return (toDeg + 180) % 360;
}

// Cool blue (low) -> warm red (high) hPa ramp, 3 stops. Deliberately not
// shared with packages/scoring's score color ramp — this is a physical-value
// gradient (hPa), not a 0-100 score, so the two ramps mean different things
// even though both are red/yellow/green-shaped conceptually.
const PRESSURE_STOPS: [number, [number, number, number]][] = [
  [995, [59, 130, 246]], // blue — low pressure
  [1013, [234, 234, 234]], // neutral grey — average sea-level pressure
  [1030, [239, 68, 68]], // red — high pressure
];

export function pressureToColor(hpa: number): [number, number, number] {
  const stops = PRESSURE_STOPS;
  if (hpa <= stops[0]![0]) return stops[0]![1];
  if (hpa >= stops[stops.length - 1]![0]) return stops[stops.length - 1]![1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [v0, c0] = stops[i]!;
    const [v1, c1] = stops[i + 1]!;
    if (hpa >= v0 && hpa <= v1) {
      const t = (hpa - v0) / (v1 - v0);
      return [Math.round(c0[0] + (c1[0] - c0[0]) * t), Math.round(c0[1] + (c1[1] - c0[1]) * t), Math.round(c0[2] + (c1[2] - c0[2]) * t)];
    }
  }
  return stops[stops.length - 1]![1];
}
