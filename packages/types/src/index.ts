export type Mode = "shore" | "boat" | "spearfishing";

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface ActiveLocation extends Coordinates {
  name: string;
}

/** One contextual adjustment to a factor's weight (packages/scoring/src/
 * modulation.ts). Weights are no longer static per mode: how much a factor
 * *should* count depends on whether it's currently carrying information.
 * Emitted so the UI can explain why today weighted things differently. */
export interface WeightModifier {
  /** FactorScore.key this adjusts. */
  factorKey: string;
  /** Multiplier applied to the base weight. >1 = matters more than usual. */
  multiplier: number;
  /** Translation key into Dictionary.weightReasons, e.g. "lightMutedByCover". */
  reasonKey: string;
  params?: Record<string, number | string>;
}

export interface FactorScore {
  key: string;
  score: number;
  /** Effective weight actually used in the composite — `baseWeight` after
   * every applicable WeightModifier. Anything ranking or rendering factor
   * contributions should use this, not `baseWeight`. */
  weight: number;
  /** The mode's static weight from the active WeightProfile, before
   * contextual modulation. Shown in the UI only to explain a shift. */
  baseWeight: number;
  /** Adjustments that took `baseWeight` to `weight`; empty when conditions
   * gave this factor its ordinary say. */
  modifiers: WeightModifier[];
  /** English fallback — used server-side (logs, notification bodies) where
   * there's no i18n layer. UI must render via `noteKey`/`noteParams`
   * instead (apps/web/src/lib/i18n/renderFactorNote.ts) so Greek users
   * never see this. */
  note: string;
  /** Translation key into Dictionary.factorNotes, e.g. "pressure.falling". */
  noteKey: string;
  /** Interpolation values for the noteKey template. Reserved param names
   * `phaseKey` and `monthKey` are re-translated (moon phase / month name)
   * rather than interpolated as raw numbers. */
  noteParams?: Record<string, number | string>;
}

export interface VetoInfo {
  /** Translation key into Dictionary.vetoes, e.g. "wind.shore". */
  key: string;
  /** English fallback, same rationale as FactorScore.note. */
  note: string;
  params?: Record<string, number>;
}

export interface ScoreResult {
  score: number;
  vetoes: VetoInfo[];
  factors: FactorScore[];
  caveats: string[];
  /** Every WeightModifier that fired this hour, flattened across factors —
   * the "how today's weighting shifted" summary. Per-factor copies also
   * live on each FactorScore.modifiers. */
  modifiers: WeightModifier[];
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
  /** Solar irradiance actually reaching the surface, W/m². */
  shortwaveRadiation?: number;
  /** Top-of-atmosphere irradiance for this hour/latitude, W/m². Only useful
   * as the denominator for `shortwaveRadiation` — the ratio is atmospheric
   * transmission (~0.7 clear sky, ~0.2 heavy overcast), which unlike raw
   * cloud cover % is already normalised for sun angle and season. */
  terrestrialRadiation?: number;

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
