import type { Locale } from "./dictionary";

const OVERRIDE_KEY = "fishmap:locale-override";

// Approximate Greek bounding box (DEV_PLAN.md §7.5 / §1). A rough polygon
// exclusion for western Turkey is a known follow-up, not implemented here —
// this bbox alone is good enough odds for the language decision.
const GREECE_BBOX = { minLat: 34.5, maxLat: 41.8, minLon: 19.2, maxLon: 27.9 };

function isInGreeceBbox(lat: number, lon: number): boolean {
  return (
    lat >= GREECE_BBOX.minLat &&
    lat <= GREECE_BBOX.maxLat &&
    lon >= GREECE_BBOX.minLon &&
    lon <= GREECE_BBOX.maxLon
  );
}

export function getLocaleOverride(): Locale | null {
  const stored = localStorage.getItem(OVERRIDE_KEY);
  return stored === "en" || stored === "el" ? stored : null;
}

export function setLocaleOverride(locale: Locale | null) {
  if (locale) {
    localStorage.setItem(OVERRIDE_KEY, locale);
  } else {
    localStorage.removeItem(OVERRIDE_KEY);
  }
}

/**
 * Resolution order per DEV_PLAN.md §7.5, first hit wins. Never requests
 * geolocation permission just to pick a language — only reads it if a
 * position is already cached (e.g. from the active-location flow).
 */
export function detectLocale(cachedPosition?: { lat: number; lon: number } | null): Locale {
  const override = getLocaleOverride();
  if (override) return override;

  if (cachedPosition && isInGreeceBbox(cachedPosition.lat, cachedPosition.lon)) {
    return "el";
  }

  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone === "Europe/Athens") return "el";
  } catch {
    // Intl unavailable — fall through.
  }

  if (typeof navigator !== "undefined") {
    const languages = navigator.languages ?? [navigator.language];
    if (languages.some((lang) => lang?.toLowerCase().startsWith("el"))) return "el";
  }

  return "en";
}
