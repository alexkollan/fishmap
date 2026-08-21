export type Mode = "shore" | "boat" | "spearfishing";

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface ActiveLocation extends Coordinates {
  name: string;
}

export interface FactorScore {
  key: string;
  score: number;
  weight: number;
  note: string;
}

export interface ScoreResult {
  score: number;
  vetoes: string[];
  factors: FactorScore[];
  caveats: string[];
}

export interface WeightProfile {
  mode: Mode;
  weights: Record<string, number>;
}

/** One hourly timestep, forecast + marine fields merged. Marine fields are
 * absent when Open-Meteo has no marine coverage at this point (enclosed
 * gulfs, very shallow water — DEV_PLAN.md §11.3). */
export interface WeatherHour {
  time: string; // ISO 8601, local offset per the series' timezone

  temperature2m?: number; // °C
  apparentTemperature?: number; // °C
  pressureMsl?: number; // hPa
  surfacePressure?: number; // hPa
  windSpeed10m?: number; // km/h
  windDirection10m?: number; // deg, meteorological (from)
  windGusts10m?: number; // km/h
  cloudCover?: number; // %
  precipitation?: number; // mm
  precipitationProbability?: number; // %
  visibility?: number; // m
  relativeHumidity2m?: number; // %
  isDay?: 0 | 1;
  weatherCode?: number;

  waveHeight?: number; // m
  waveDirection?: number; // deg
  wavePeriod?: number; // s
  windWaveHeight?: number; // m
  windWaveDirection?: number; // deg
  windWavePeriod?: number; // s
  swellWaveHeight?: number; // m
  swellWaveDirection?: number; // deg
  swellWavePeriod?: number; // s
  seaSurfaceTemperature?: number; // °C
  oceanCurrentVelocity?: number; // km/h
  oceanCurrentDirection?: number; // deg
}

export interface WeatherSeries {
  hourly: WeatherHour[];
  latitude: number;
  longitude: number;
  gridLatitude: number;
  gridLongitude: number;
  timezone: string;
  fetchedAt: string; // ISO 8601
  marineAvailable: boolean;
}

export interface SunTimes {
  date: string; // yyyy-mm-dd, local to the queried point
  sunrise: string;
  sunset: string;
  civilDawn: string;
  civilDusk: string;
  nauticalDawn: string;
  nauticalDusk: string;
  solarNoon: string;
  goldenHourEveningStart: string;
  goldenHourMorningEnd: string;
}

export interface MoonData {
  moonrise: string | null;
  moonset: string | null;
  phase: number; // 0-1, SunCalc convention (0/1 = new, 0.5 = full)
  illumination: number; // 0-1
  transitTime: string | null; // moon overhead — solunar major
  antiTransitTime: string | null; // moon underfoot — solunar major
}

export interface SolunarWindow {
  type: "major" | "minor";
  start: string;
  center: string;
  end: string;
  alignsWithTwilight: boolean;
}

export interface SunMoonData {
  sun: SunTimes;
  moon: MoonData;
  solunar: SolunarWindow[];
}

export interface DailyScore {
  date: string; // yyyy-mm-dd
  score: number; // representative (best daylight-hour) score
  minScore: number;
  maxScore: number;
  bestHour: string; // ISO time of the best hour that day
}
