import { get, set } from "idb-keyval";
import type { ActiveLocation } from "@fishmap/types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const CACHE_PREFIX = "fishmap:nominatim:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_REQUEST_GAP_MS = 1100; // Nominatim usage policy: max 1 req/s.

let lastRequestAt = 0;

interface CachedSearch {
  fetchedAt: number;
  results: ActiveLocation[];
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

async function respectRateLimit() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_REQUEST_GAP_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_GAP_MS - elapsed));
  }
  lastRequestAt = Date.now();
}

/** Debounced by the caller (see location/useLocationSearch.ts). */
export async function searchLocations(query: string, signal?: AbortSignal): Promise<ActiveLocation[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const cacheKey = `${CACHE_PREFIX}${trimmed.toLowerCase()}`;
  const cached = await get<CachedSearch>(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.results;
  }

  await respectRateLimit();

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "gr");
  url.searchParams.set("limit", "8");

  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Nominatim search failed: ${res.status}`);

  const raw: NominatimResult[] = await res.json();
  const results: ActiveLocation[] = raw.map((r) => ({
    lat: Number(r.lat),
    lon: Number(r.lon),
    name: r.display_name.split(",")[0]!.trim(),
  }));

  await set(cacheKey, { fetchedAt: Date.now(), results } satisfies CachedSearch);
  return results;
}
