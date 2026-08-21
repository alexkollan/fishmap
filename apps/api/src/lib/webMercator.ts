// XYZ tile -> EPSG:3857 bbox, for turning MapLibre raster tile requests into
// WMS GetMap calls (DEV_PLAN.md §3.4/§5.5: EMODnet is WMS, not natively XYZ).
const EARTH_CIRCUMFERENCE_M = 40_075_016.685_578_5;
const ORIGIN_SHIFT = EARTH_CIRCUMFERENCE_M / 2;

export function tileToMercatorBbox(z: number, x: number, y: number): [number, number, number, number] {
  const tileSize = EARTH_CIRCUMFERENCE_M / 2 ** z;
  const minX = x * tileSize - ORIGIN_SHIFT;
  const maxX = (x + 1) * tileSize - ORIGIN_SHIFT;
  const maxY = ORIGIN_SHIFT - y * tileSize;
  const minY = ORIGIN_SHIFT - (y + 1) * tileSize;
  return [minX, minY, maxX, maxY];
}
