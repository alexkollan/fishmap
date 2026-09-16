import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { ActiveLocation } from "@fishmap/types";
import { useLocationStore, type LocationSource } from "./store";

// Central Aegean-facing default so the app is usable before any location
// has ever been picked (DEV_PLAN.md §7.3 fallback chain, last resort).
export const DEFAULT_LOCATION: ActiveLocation = { lat: 37.9838, lon: 23.7275, name: "Athens" };

/** Whether the app was *opened* on a URL that already named a location —
 * i.e. a shared or bookmarked deep link, which must always win over the
 * map's landing auto-locate (useVisitorLocation).
 *
 * Captured at module scope on purpose. This module is pulled in at boot via
 * App.tsx → AppShell → Header, so it reads the URL before the sync effect
 * below has had a chance to write coordinates into it — by the time any
 * component could ask, the answer would otherwise always be "yes". */
export const INITIAL_URL_HAD_COORDS = (() => {
  const params = new URLSearchParams(window.location.search);
  return params.has("lat") && params.has("lon");
})();

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
    // "auto": the app picked this, not the visitor, so the map's landing
    // auto-locate is allowed to replace it (see useVisitorLocation).
    if (!location) setLocationInStore(fallback, "auto");

    const next = new URLSearchParams(searchParams);
    next.set("lat", String(fallback.lat));
    next.set("lon", String(fallback.lon));
    next.set("name", fallback.name);
    setSearchParams(next, { replace: true });
    // Only re-run when the URL itself changes; store writes above are
    // reflected back on the next render via the params branch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function setLocation(next: ActiveLocation, source: LocationSource = "manual") {
    setLocationInStore(next, source);
    const params = new URLSearchParams(searchParams);
    params.set("lat", String(next.lat));
    params.set("lon", String(next.lon));
    params.set("name", next.name);
    setSearchParams(params, { replace: true });
  }

  return { location: location ?? DEFAULT_LOCATION, setLocation };
}
