import { db } from "./index.js";

interface CacheRow {
  payload: string;
  fetched_at: number;
}

function getCached(gridLat: number, gridLon: number, variableSet: string) {
  const row = db
    .prepare(
      `SELECT payload, fetched_at FROM weather_cache WHERE grid_lat = ? AND grid_lon = ? AND variable_set = ?`,
    )
    .get(gridLat, gridLon, variableSet) as CacheRow | undefined;
  if (!row) return null;
  return { payload: JSON.parse(row.payload) as unknown, fetchedAt: row.fetched_at };
}

function setCached(gridLat: number, gridLon: number, variableSet: string, payload: unknown) {
  db.prepare(
    `INSERT INTO weather_cache (grid_lat, grid_lon, variable_set, payload, fetched_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(grid_lat, grid_lon, variable_set)
     DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
  ).run(gridLat, gridLon, variableSet, JSON.stringify(payload), Date.now());
}

/**
 * Cache-aside with stale-while-revalidate (DEV_PLAN.md §5.5): a fresh cache
 * hit skips the network entirely; a stale/missing entry triggers a refetch,
 * but if that refetch fails we still serve whatever's cached rather than
 * erroring the request.
 */
export async function cached<T>(
  gridLat: number,
  gridLon: number,
  variableSet: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<{ data: T; stale: boolean }> {
  const existing = getCached(gridLat, gridLon, variableSet);
  if (existing && Date.now() - existing.fetchedAt < ttlMs) {
    return { data: existing.payload as T, stale: false };
  }

  try {
    const data = await fetcher();
    setCached(gridLat, gridLon, variableSet, data);
    return { data, stale: false };
  } catch (err) {
    if (existing) return { data: existing.payload as T, stale: true };
    throw err;
  }
}

/**
 * Same cache-aside contract as `cached`, but for many grid cells at once
 * (the map's viewport fetch, DEV_PLAN.md §5.2): cache hits are served
 * individually, every miss/stale cell is refetched in a *single* upstream
 * call via `fetchMany`, keeping "pan the whole Aegean = one request" true
 * even though dozens of grid cells are involved.
 */
export async function cachedBatch<T>(
  points: { gridLat: number; gridLon: number }[],
  variableSet: string,
  ttlMs: number,
  fetchMany: (misses: { gridLat: number; gridLon: number }[]) => Promise<T[]>,
): Promise<Map<string, { data: T; stale: boolean }>> {
  const result = new Map<string, { data: T; stale: boolean }>();
  const misses: { gridLat: number; gridLon: number }[] = [];

  for (const p of points) {
    const key = `${p.gridLat},${p.gridLon}`;
    const existing = getCached(p.gridLat, p.gridLon, variableSet);
    if (existing && Date.now() - existing.fetchedAt < ttlMs) {
      result.set(key, { data: existing.payload as T, stale: false });
    } else {
      misses.push(p);
    }
  }

  if (misses.length === 0) return result;

  try {
    const fetched = await fetchMany(misses);
    misses.forEach((p, i) => {
      const key = `${p.gridLat},${p.gridLon}`;
      const data = fetched[i];
      if (data === undefined) return;
      setCached(p.gridLat, p.gridLon, variableSet, data);
      result.set(key, { data, stale: false });
    });
  } catch {
    // Upstream batch failed entirely — fall back to whatever stale cache
    // each missed cell has rather than dropping it from the response.
    for (const p of misses) {
      const key = `${p.gridLat},${p.gridLon}`;
      const existing = getCached(p.gridLat, p.gridLon, variableSet);
      if (existing) result.set(key, { data: existing.payload as T, stale: true });
    }
  }

  return result;
}
