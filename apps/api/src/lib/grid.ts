// Weather is spatially smooth (DEV_PLAN.md §5.2) — snap requests to a 0.25°
// grid (~25 km) so nearby points share the same cache row instead of each
// spawning its own upstream call.
const GRID_STEP = 0.25;

export function snapToGrid(value: number, step = GRID_STEP): number {
  return Math.round(value / step) * step;
}
