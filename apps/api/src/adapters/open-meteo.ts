// Open-Meteo adapter — no API key, CORS-enabled, free for non-commercial use
// (DEV_PLAN.md §3.1). Single-point fetchForecast/fetchMarine below cover
// every per-spot page. A batched area-grid pipeline (map factor layers) was
// removed 2026-08-25 — see PROGRESS.md — after turning out to need a
// genuinely cold sweep costing ~115 minutes even with every optimization
// tried, against Open-Meteo's free-tier rate limits (~7,844 cells, 26
// variables/cell). fetchForecastBatch/fetchMarineBatch below revive the same
// batching shape for the wind/current/pressure map layer (jobs/
// vectorFieldRefresh.ts), but scoped to a ~25x smaller grid (0.5° vs 0.1°,
// see lib/areaGrid.ts) and only 5 variables total instead of 26 — comfortably
// inside the same limit that broke the old design, verified by the math in
// vectorFieldRefresh.ts's comments, not just hoped.
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const MARINE_URL = "https://marine-api.open-meteo.com/v1/marine";

const FORECAST_HOURLY = [
  "temperature_2m",
  "apparent_temperature",
  "surface_pressure",
  "pressure_msl",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "cloud_cover",
  "precipitation",
  "precipitation_probability",
  "visibility",
  "relative_humidity_2m",
  "is_day",
  "weather_code",
].join(",");

const MARINE_HOURLY = [
  "wave_height",
  "wave_direction",
  "wave_period",
  "wind_wave_height",
  "wind_wave_direction",
  "wind_wave_period",
  "swell_wave_height",
  "swell_wave_direction",
  "swell_wave_period",
  "sea_surface_temperature",
  "ocean_current_velocity",
  "ocean_current_direction",
].join(",");

export interface OpenMeteoHourlyResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  hourly: {
    time: string[];
    [variable: string]: string[] | (number | null)[];
  };
}

const REQUEST_TIMEOUT_MS = 20_000;

async function fetchOpenMeteo(
  url: string,
  params: Record<string, string>,
): Promise<OpenMeteoHourlyResponse> {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${url}?${qs.toString()}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`Open-Meteo request failed (${res.status}): ${await res.text()}`);
  }
  return res.json() as Promise<OpenMeteoHourlyResponse>;
}

// past_days=2 gives real historical hours instead of only forward-looking
// ones — the pressure (3h/6h) and sea-temp (48h) trend factors need lookback
// that "today onward" alone can't provide (packages/scoring §4.1, §4.5).
const PAST_DAYS = 2;

export function fetchForecast(lat: number, lon: number, days = 7) {
  return fetchOpenMeteo(FORECAST_URL, {
    latitude: String(lat),
    longitude: String(lon),
    hourly: FORECAST_HOURLY,
    forecast_days: String(days),
    past_days: String(PAST_DAYS),
    timezone: "auto",
  });
}

export function fetchMarine(lat: number, lon: number, days = 7) {
  return fetchOpenMeteo(MARINE_URL, {
    latitude: String(lat),
    longitude: String(lon),
    hourly: MARINE_HOURLY,
    forecast_days: String(days),
    past_days: String(PAST_DAYS),
    timezone: "auto",
  });
}

// --- Batched area-grid fetch (wind/current/pressure map layer only) --------
// Narrow on purpose: only the variables the particle/gradient layer actually
// renders. No past_days — there's no trend factor here, unlike the
// single-point fetchers above, so there's nothing to look back for.
const AREA_FORECAST_HOURLY = ["wind_speed_10m", "wind_direction_10m", "pressure_msl"].join(",");
const AREA_MARINE_HOURLY = ["ocean_current_velocity", "ocean_current_direction"].join(",");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RATE_LIMIT_RETRIES = 4;

async function fetchOpenMeteoBatch(
  url: string,
  points: { lat: number; lon: number }[],
  hourly: string,
  days: number,
): Promise<OpenMeteoHourlyResponse[]> {
  const qs = new URLSearchParams({
    latitude: points.map((p) => String(p.lat)).join(","),
    longitude: points.map((p) => String(p.lon)).join(","),
    hourly,
    forecast_days: String(days),
    timezone: "auto",
  });
  const requestUrl = `${url}?${qs.toString()}`;

  // Open-Meteo's free tier enforces a per-minute request cap (observed
  // directly during the old area-grid's development: firing batch requests
  // back to back with no pacing hit "Minutely API request limit exceeded" /
  // 503 "service overloaded" after only a handful). Retrying with backoff
  // here means every caller of the batch fetchers gets the same resilience.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(requestUrl, { signal: AbortSignal.timeout(45_000) });
    if (res.ok) {
      const json = (await res.json()) as OpenMeteoHourlyResponse | OpenMeteoHourlyResponse[];
      // Open-Meteo returns a bare object for a single coordinate pair and an
      // array once there's more than one — normalise to always-an-array.
      return Array.isArray(json) ? json : [json];
    }

    const retryable = res.status === 429 || res.status === 503;
    if (!retryable || attempt >= MAX_RATE_LIMIT_RETRIES) {
      throw new Error(`Open-Meteo batch request failed (${res.status}): ${await res.text()}`);
    }
    const retryAfterHeader = Number(res.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader * 1000 : 65_000;
    await sleep(waitMs);
  }
}

export function fetchForecastBatch(points: { lat: number; lon: number }[], days = 2) {
  return fetchOpenMeteoBatch(FORECAST_URL, points, AREA_FORECAST_HOURLY, days);
}

export function fetchMarineBatch(points: { lat: number; lon: number }[], days = 2) {
  return fetchOpenMeteoBatch(MARINE_URL, points, AREA_MARINE_HOURLY, days);
}
