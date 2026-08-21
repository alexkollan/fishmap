import type { ActiveLocation } from "@fishmap/types";

const REVERSE_GEOCODE_URL = "https://nominatim.openstreetmap.org/reverse";
const IP_GEOLOCATION_URL = "https://ipapi.co/json/";

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const url = new URL(REVERSE_GEOCODE_URL);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("format", "jsonv2");
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("reverse geocode failed");
    const data = await res.json();
    const name: string | undefined = data.name || data.display_name?.split(",")[0];
    return name?.trim() || "My location";
  } catch {
    return "My location";
  }
}

/**
 * Must be called from a user gesture handler — never on mount/page load
 * (DEV_PLAN.md §7.3). Low accuracy is intentional: a fishing spot doesn't
 * need 3 m precision, and it's kinder to battery.
 */
export function requestGeolocation(): Promise<ActiveLocation> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lon } = position.coords;
        const name = await reverseGeocode(lat, lon);
        resolve({ lat, lon, name });
      },
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  });
}

/**
 * Coarse fallback when precise geolocation is unavailable/denied. Free,
 * no-key IP lookup — accuracy is city-level at best, which is fine as a
 * fallback ahead of the Greek-centroid default (DEV_PLAN.md §7.3).
 */
export async function getIpFallbackLocation(): Promise<ActiveLocation | null> {
  try {
    const res = await fetch(IP_GEOLOCATION_URL);
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.latitude !== "number" || typeof data.longitude !== "number") return null;
    return { lat: data.latitude, lon: data.longitude, name: data.city || "My area" };
  } catch {
    return null;
  }
}
