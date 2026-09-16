import { useCallback, useEffect, useRef, useState } from "react";
import type { ActiveLocation } from "@fishmap/types";
import { getIpFallbackLocation, requestGeolocation } from "./geolocation";
import { INITIAL_URL_HAD_COORDS } from "./useActiveLocation";
import { useLocationStore } from "./store";

const VISIT_FLAG = "fishmap:visit-located";

/**
 * Places the map's pin on the visitor automatically when they land, without
 * ever triggering a permission prompt on page load — DEV_PLAN.md §7.3 and
 * geolocation.ts are both explicit that the browser prompt only belongs
 * behind a user gesture, and a permission dialog firing over a map the
 * visitor hasn't even looked at yet is exactly what that rule exists to
 * prevent. So the landing path resolves silently:
 *
 * 1. Precise GPS, but **only if permission was already granted** — a
 *    `permissions.query` of "granted" means `getCurrentPosition` resolves
 *    without showing anything, so a returning visitor who opted in once gets
 *    their real position with no dialog.
 * 2. Otherwise the coarse IP lookup, which needs no permission at all. It's
 *    city-level, which is the right order of magnitude for "which bit of
 *    coast am I looking at" and is already the §7.3 fallback.
 * 3. Otherwise leave whatever the store had (ultimately the Athens default).
 *
 * `locate()` is the escape hatch for the on-map button — called from a real
 * gesture, so it may prompt.
 *
 * Runs at most once per tab (sessionStorage), and never overrides a location
 * the visitor deliberately chose or arrived at via a shared link.
 */
export function useVisitorLocation(onResolved: (location: ActiveLocation, precise: boolean) => void) {
  const source = useLocationStore((s) => s.source);
  const hasStoredLocation = useLocationStore((s) => s.location !== null);
  const [locating, setLocating] = useState(false);
  const [approximate, setApproximate] = useState(false);

  // Kept in a ref so the landing effect never re-fires when the pin moves —
  // it depends on the callback identity otherwise, and MapPage's handler
  // changes whenever the location does.
  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;

  useEffect(() => {
    if (INITIAL_URL_HAD_COORDS) return;
    // A location the visitor picked themselves outlives the visit.
    if (hasStoredLocation && source === "manual") return;
    try {
      if (sessionStorage.getItem(VISIT_FLAG)) return;
      sessionStorage.setItem(VISIT_FLAG, "1");
    } catch {
      // Private mode / blocked storage: fall through and locate once. The
      // effect itself only runs on mount, so this can't loop.
    }

    let cancelled = false;
    setLocating(true);

    void (async () => {
      try {
        let granted = false;
        try {
          const status = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
          granted = status?.state === "granted";
        } catch {
          granted = false;
        }

        if (granted) {
          const precise = await requestGeolocation();
          if (!cancelled) {
            setApproximate(false);
            onResolvedRef.current(precise, true);
          }
          return;
        }

        const coarse = await getIpFallbackLocation();
        if (coarse && !cancelled) {
          setApproximate(true);
          onResolvedRef.current(coarse, false);
        }
      } catch {
        // Every step here is best-effort — the store's existing location
        // (ultimately the Athens default) is a perfectly usable outcome.
      } finally {
        if (!cancelled) setLocating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Landing behaviour: mount only, deliberately not reactive to the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** User-gesture path — may show the browser permission prompt. */
  const locate = useCallback(async () => {
    setLocating(true);
    try {
      const precise = await requestGeolocation();
      setApproximate(false);
      onResolvedRef.current(precise, true);
    } catch {
      const coarse = await getIpFallbackLocation();
      if (coarse) {
        setApproximate(true);
        onResolvedRef.current(coarse, false);
      }
    } finally {
      setLocating(false);
    }
  }, []);

  return { locating, approximate, locate };
}
