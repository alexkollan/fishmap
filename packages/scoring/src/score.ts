import type {
  FactorScore,
  Mode,
  ScoreResult,
  SunMoonData,
  WeatherHour,
  WeightModifier,
  WeightProfile,
} from "@fishmap/types";
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
import { buildWeightModifiers, deriveContext, effectiveWeight, noDataModifier } from "./modulation.js";
import { checkVetoes } from "./vetoes.js";
import { DEFAULT_WEIGHT_PROFILES } from "./weights.js";

function toFactorScore(raw: RawFactor, profile: WeightProfile, contextModifiers: WeightModifier[]): FactorScore {
  const baseWeight = profile.weights[raw.key] ?? 0;
  const noData = noDataModifier(raw.key, raw.noteKey);
  const modifiers = contextModifiers.filter((m) => m.factorKey === raw.key);
  if (noData) modifiers.push(noData);

  return {
    key: raw.key,
    score: raw.score,
    weight: effectiveWeight(baseWeight, modifiers),
    baseWeight,
    modifiers,
    note: raw.note,
    noteKey: raw.noteKey,
    noteParams: raw.noteParams,
  };
}

/** Weighted average over effective weights. Falls back to base weights if
 * modulation somehow left nothing to divide by — a score of 0 would read as
 * "terrible conditions" rather than "the weighting broke," which is the
 * worst possible way for this to fail. */
function weightedAverage(factors: FactorScore[]): number {
  let sum = 0;
  let totalWeight = 0;
  for (const f of factors) {
    sum += f.score * f.weight;
    totalWeight += f.weight;
  }
  if (totalWeight > 0) return sum / totalWeight;

  let baseSum = 0;
  let baseTotal = 0;
  for (const f of factors) {
    baseSum += f.score * f.baseWeight;
    baseTotal += f.baseWeight;
  }
  return baseTotal > 0 ? baseSum / baseTotal : 0;
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
  aspectDeg?: number,
): ScoreResult {
  const wx = hourly[index];
  const caveats: string[] = [];
  if (!wx) {
    return {
      score: 0,
      vetoes: [{ key: "noData", note: "No weather data for this hour." }],
      factors: [],
      caveats,
      modifiers: [],
    };
  }
  if (wx.waveHeight === undefined) {
    caveats.push(
      "No marine data near this point (enclosed water or thin coverage) — scoring from atmospheric factors only.",
    );
  }

  const raw: RawFactor[] = [
    pressureTrend(hourly, index),
    windRelative(wx, mode, aspectDeg),
    waveConditions(wx, mode),
    turbidity(hourly, index, mode),
    seaTempFactor(hourly, index),
    lightWindow(wx, sunMoon.sun, mode),
    precipitationFactor(wx),
    solunarFactor(wx, sunMoon),
    currentFactor(wx, mode, aspectDeg),
    seasonality(wx),
  ];

  // Weights are contextual, not static (modulation.ts): how much a factor
  // should decide the score depends on whether it's currently carrying any
  // information. The profile supplies the baseline; conditions reshape it.
  const context = deriveContext(hourly, index, sunMoon, mode, aspectDeg);
  const contextModifiers = buildWeightModifiers(context);

  const factors = raw.map((r) => toFactorScore(r, profile, contextModifiers));
  const vetoes = checkVetoes(wx, mode);
  const rawScore = weightedAverage(factors);
  const score = vetoes.length > 0 ? Math.min(20, Math.round(rawScore)) : Math.round(rawScore);

  return { score, vetoes, factors, caveats, modifiers: factors.flatMap((f) => f.modifiers) };
}
