import { GREECE_BBOX } from "./bbox.js";
import { snapToGrid } from "./grid.js";

// 0.5° — coarse on purpose. This grid backs a purely visual wind/current/
// pressure map layer (see routes/fields.ts), not scoring, so it doesn't need
// the 0.25° point-grid's precision. A prior 0.1° version of this same idea
// (~7,844 cells, 26 variables/cell) needed a genuinely cold sweep costing 115
// minutes and got removed entirely after repeatedly tripping Open-Meteo's
// free-tier rate limit (see PROGRESS.md, 2026-08-24/25) — at 0.5° this grid
// is ~25x smaller (352 cells) and jobs/vectorFieldRefresh.ts only requests 5
// variables total, which is what actually keeps this under the limit this
// time, not just a smaller number picked hopefully.
export const AREA_GRID_STEP = 0.5;

export interface AreaGridCell {
  gridLat: number;
  gridLon: number;
}

export interface AreaGrid {
  nx: number;
  ny: number;
  cells: AreaGridCell[];
}

/**
 * Full rectangular grid over the Greek bbox at AREA_GRID_STEP, row-major
 * from south to north (row 0 = minLat) then west to east (col 0 = minLon).
 * The refresh job and the /api/fields/area route must build this the same
 * way so cache keys and response array ordering line up.
 */
export function buildAreaGrid(step: number = AREA_GRID_STEP): AreaGrid {
  const nx = Math.round((GREECE_BBOX.maxLon - GREECE_BBOX.minLon) / step) + 1;
  const ny = Math.round((GREECE_BBOX.maxLat - GREECE_BBOX.minLat) / step) + 1;

  const cells: AreaGridCell[] = [];
  for (let row = 0; row < ny; row++) {
    const gridLat = snapToGrid(GREECE_BBOX.minLat + row * step, step);
    for (let col = 0; col < nx; col++) {
      const gridLon = snapToGrid(GREECE_BBOX.minLon + col * step, step);
      cells.push({ gridLat, gridLon });
    }
  }

  return { nx, ny, cells };
}
