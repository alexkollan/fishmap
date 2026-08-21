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
