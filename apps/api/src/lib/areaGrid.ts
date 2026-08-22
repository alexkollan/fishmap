import { GREECE_BBOX } from "./bbox.js";
import { snapToGrid } from "./grid.js";

// Finer than the 0.25° point/coastline grid — the map's per-factor "weather
// map" overlay needs enough cells that MapLibre's linear texture filtering
// (raster-resampling: "linear" on the frontend layer) reads as a smooth
// gradient rather than visible blocks, without pretending to real 500m
// precision Open-Meteo doesn't have.
export const AREA_GRID_STEP = 0.1;

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
 * Both the refresh cron and the /api/scores/area route must build this the
 * same way so cache keys and response ordering line up.
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
