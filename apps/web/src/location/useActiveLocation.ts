import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { ActiveLocation } from "@fishmap/types";
import { useLocationStore } from "./store";

// Central Aegean-facing default so the app is usable before any location
// has ever been picked (DEV_PLAN.md §7.3 fallback chain, last resort).
export const DEFAULT_LOCATION: ActiveLocation = { lat: 37.9838, lon: 23.7275, name: "Athens" };

/**
 * The single source of truth for "where is the app currently looking".
 * URL search params win on read (so deep links and shared links work);
 * the store is the persisted fallback when a route has no params yet.
 * Pages call this and never touch searchParams directly (DEV_PLAN.md §6.1).
 */
export function useActiveLocation() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocationStore((s) => s.location);
  const setLocationInStore = useLocationStore((s) => s.setLocation);

  useEffect(() => {
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const name = searchParams.get("name");

    if (lat !== null && lon !== null) {
      const parsed: ActiveLocation = { lat: Number(lat), lon: Number(lon), name: name ?? "" };
      const unchanged =
        location &&
        location.lat === parsed.lat &&
        location.lon === parsed.lon &&
        location.name === parsed.name;
      if (!unchanged) setLocationInStore(parsed);
      return;
    }

    const fallback = location ?? DEFAULT_LOCATION;
    if (!location) setLocationInStore(fallback);

    const next = new URLSearchParams(searchParams);
    next.set("lat", String(fallback.lat));
    next.set("lon", String(fallback.lon));
    next.set("name", fallback.name);
    setSearchParams(next, { replace: true });
    // Only re-run when the URL itself changes; store writes above are
    // reflected back on the next render via the params branch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function setLocation(next: ActiveLocation) {
    setLocationInStore(next);
    const params = new URLSearchParams(searchParams);
    params.set("lat", String(next.lat));
    params.set("lon", String(next.lon));
    params.set("name", next.name);
    setSearchParams(params, { replace: true });
  }

  return { location: location ?? DEFAULT_LOCATION, setLocation };
}
