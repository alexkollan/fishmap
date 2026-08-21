import type { WeatherSeries } from "@fishmap/types";

// Relative path — proxied to the api service by Vite in dev and by nginx in
// prod (see vite.config.ts / apps/web/nginx.conf), so this needs no
// environment-specific base URL.
export async function fetchWeather(lat: number, lon: number, signal?: AbortSignal): Promise<WeatherSeries> {
  const url = new URL("/api/weather", window.location.origin);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Weather request failed: ${res.status}`);
  return res.json() as Promise<WeatherSeries>;
}
