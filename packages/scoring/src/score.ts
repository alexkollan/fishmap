import type { FactorScore, Mode, ScoreResult, SunMoonData, WeatherHour, WeightProfile } from "@fishmap/types";
import {
  currentFactor,
  lightWindow,
  precipitationFactor,
  pressureTrend,
  seaTempFactor,
  seasonality,
  solunarFactor,
  turbidity,
  waveConditions,
  windRelative,
  type RawFactor,
} from "./factors.js";
import { checkVetoes } from "./vetoes.js";
import { DEFAULT_WEIGHT_PROFILES } from "./weights.js";

function toFactorScore(raw: RawFactor, profile: WeightProfile): FactorScore {
  return { key: raw.key, score: raw.score, weight: profile.weights[raw.key] ?? 0, note: raw.note };
}

function weightedAverage(factors: FactorScore[]): number {
  let sum = 0;
  let totalWeight = 0;
  for (const f of factors) {
    sum += f.score * f.weight;
    totalWeight += f.weight;
  }
  return totalWeight > 0 ? sum / totalWeight : 0;
}

/**
 * Single-point composite score for one hour (DEV_PLAN.md §4.13, minus the
 * `structure(seg)` term — that's baked per coastline segment and doesn't
 * exist until the Phase 4 pipeline runs). Both the web app (inline, no
 * worker — §5.6) and, later, the notification cron import this directly so
 * there is never a second implementation of the score.
 */
export function scoreHour(
  hourly: WeatherHour[],
  index: number,
  sunMoon: SunMoonData,
  mode: Mode,
  profile: WeightProfile = DEFAULT_WEIGHT_PROFILES[mode],
): ScoreResult {
  const wx = hourly[index];
  const caveats: string[] = [];
  if (!wx) {
    return { score: 0, vetoes: ["No weather data for this hour."], factors: [], caveats };
  }
  if (wx.waveHeight === undefined) {
    caveats.push(
      "No marine data near this point (enclosed water or thin coverage) — scoring from atmospheric factors only.",
    );
  }

  const raw: RawFactor[] = [
    pressureTrend(hourly, index),
    windRelative(wx, mode),
    waveConditions(wx, mode),
    turbidity(hourly, index, mode),
    seaTempFactor(hourly, index),
    lightWindow(wx, sunMoon.sun, mode),
    precipitationFactor(wx),
    solunarFactor(wx, sunMoon),
    currentFactor(wx, mode),
    seasonality(wx),
  ];

  const factors = raw.map((r) => toFactorScore(r, profile));
  const vetoes = checkVetoes(wx, mode);
  const rawScore = weightedAverage(factors);
  const score = vetoes.length > 0 ? Math.min(20, Math.round(rawScore)) : Math.round(rawScore);

  return { score, vetoes, factors, caveats };
}
