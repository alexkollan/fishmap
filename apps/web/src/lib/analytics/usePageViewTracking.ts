import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "./gtag";
import { useAnalyticsConsent } from "./AnalyticsProvider";

/** Fires a page_view on every route change — gtag's automatic pageview only
 * covers the initial script load, and this is an SPA. Debounced because
 * useActiveLocation syncs lat/lon/name into the URL a render after
 * navigation, which would otherwise double-fire a page_view per route. */
export function usePageViewTracking() {
  const location = useLocation();
  const { consent } = useAnalyticsConsent();

  useEffect(() => {
    if (consent !== "granted") return;
    const path = location.pathname + location.search;
    const timer = setTimeout(() => trackPageView(path), 150);
    return () => clearTimeout(timer);
  }, [location.pathname, location.search, consent]);
}
