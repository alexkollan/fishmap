import type { WeatherSeries } from "@fishmap/types";

// Server caps a single request at 120 points (apps/api/src/routes/weather.ts)
// — chunk under that so a full-Greece viewport still resolves in a handful
// of parallel calls instead of one giant one.
const CHUNK_SIZE = 100;

export async function fetchWeatherGrid(points: { lat: number; lon: number }[], signal?: AbortSignal): Promise<WeatherSeries[]> {
  if (points.length === 0) return [];

  const chunks: { lat: number; lon: number }[][] = [];
  for (let i = 0; i < points.length; i += CHUNK_SIZE) chunks.push(points.slice(i, i + CHUNK_SIZE));

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const url = new URL("/api/weather/grid", window.location.origin);
      url.searchParams.set("points", chunk.map((p) => `${p.lat},${p.lon}`).join(";"));
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`Grid weather request failed: ${res.status}`);
      const data = (await res.json()) as { points: WeatherSeries[] };
      return data.points;
    }),
  );

  return results.flat();
}
