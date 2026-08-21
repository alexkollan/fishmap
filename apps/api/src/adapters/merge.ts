import type { WeatherHour, WeatherSeries } from "@fishmap/types";
import type { OpenMeteoHourlyResponse } from "./open-meteo.js";
import { zonedNaiveToUtcIso } from "../lib/tz.js";

function at(arr: unknown, i: number): number | undefined {
  if (!Array.isArray(arr)) return undefined;
  const v = arr[i];
  return typeof v === "number" ? v : undefined;
}

export function mergeToSeries(
  forecast: OpenMeteoHourlyResponse,
  marine: OpenMeteoHourlyResponse | null,
  gridLat: number,
  gridLon: number,
): WeatherSeries {
  const times = forecast.hourly.time;
  const f = forecast.hourly;
  const m = marine?.hourly;

  const marineIndexByTime = new Map<string, number>();
  if (m) m.time.forEach((t, i) => marineIndexByTime.set(t, i));

  const hourly: WeatherHour[] = times.map((time, i) => {
    const hour: WeatherHour = {
      // Converted to a true UTC instant here — see lib/tz.ts for why the
      // raw Open-Meteo string can't be trusted with a plain `new Date()`.
      time: zonedNaiveToUtcIso(time, forecast.timezone),
      temperature2m: at(f.temperature_2m, i),
      apparentTemperature: at(f.apparent_temperature, i),
      pressureMsl: at(f.pressure_msl, i),
      surfacePressure: at(f.surface_pressure, i),
      windSpeed10m: at(f.wind_speed_10m, i),
      windDirection10m: at(f.wind_direction_10m, i),
      windGusts10m: at(f.wind_gusts_10m, i),
      cloudCover: at(f.cloud_cover, i),
      precipitation: at(f.precipitation, i),
      precipitationProbability: at(f.precipitation_probability, i),
      visibility: at(f.visibility, i),
      relativeHumidity2m: at(f.relative_humidity_2m, i),
      isDay: at(f.is_day, i) as 0 | 1 | undefined,
      weatherCode: at(f.weather_code, i),
    };

    const mi = m ? marineIndexByTime.get(time) : undefined;
    if (m && mi !== undefined) {
      hour.waveHeight = at(m.wave_height, mi);
      hour.waveDirection = at(m.wave_direction, mi);
      hour.wavePeriod = at(m.wave_period, mi);
      hour.windWaveHeight = at(m.wind_wave_height, mi);
      hour.windWaveDirection = at(m.wind_wave_direction, mi);
      hour.windWavePeriod = at(m.wind_wave_period, mi);
      hour.swellWaveHeight = at(m.swell_wave_height, mi);
      hour.swellWaveDirection = at(m.swell_wave_direction, mi);
      hour.swellWavePeriod = at(m.swell_wave_period, mi);
      hour.seaSurfaceTemperature = at(m.sea_surface_temperature, mi);
      hour.oceanCurrentVelocity = at(m.ocean_current_velocity, mi);
      hour.oceanCurrentDirection = at(m.ocean_current_direction, mi);
    }

    return hour;
  });

  const marineAvailable = hourly.some((h) => h.waveHeight !== undefined);

  return {
    hourly,
    latitude: forecast.latitude,
    longitude: forecast.longitude,
    gridLatitude: gridLat,
    gridLongitude: gridLon,
    timezone: forecast.timezone,
    fetchedAt: new Date().toISOString(),
    marineAvailable,
  };
}
