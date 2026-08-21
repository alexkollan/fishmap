// Open-Meteo adapter — no API key, CORS-enabled, free for non-commercial use
// (DEV_PLAN.md §3.1). Both endpoints accept comma-separated lat/lon lists for
// batching; Phase 2 only needs single-point calls, batching lands with the
// map's viewport fetch in Phase 5.
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

async function fetchOpenMeteo(
  url: string,
  params: Record<string, string>,
): Promise<OpenMeteoHourlyResponse> {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${url}?${qs.toString()}`);
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
