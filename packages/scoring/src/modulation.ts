// Contextual weight modulation — added 2026-09-16.
//
// Until now a factor's weight was a constant per mode (weights.ts): light was
// worth 20% of a shore score at 05:00 on a clear June dawn and at 13:00 under
// a black February overcast, identically. That's not how any of this works.
// The weight of a factor is not "how important is this variable in general,"
// it's "how much does knowing this variable's value tell me about *today*" —
// and that is itself a function of the other variables.
//
// The worked example that prompted this: midday is a strong negative for
// shore fishing because bright overhead sun drives fish deep and makes them
// wary. Put a heavy cloud deck over it and most of that mechanism is simply
// gone — surface irradiance can drop by 4-5x, the water column's light
// gradient flattens, and fish hold shallow through the middle of the day.
// The time of day hasn't changed; how much it *matters* has collapsed. The
// old code half-acknowledged this by multiplying light's score by up to 1.6
// under overcast, which makes the wrong claim: it says pitch-dark-at-noon is
// good light, rather than that light stopped being the deciding variable.
// Score answers "how good is this condition"; weight answers "how much should
// it decide the number." Cloud cover moves both, but mostly the second.
//
// Every rule below is (a) mechanistic — there's a physical reason the signal
// strengthens or weakens, not just a correlation — and (b) explainable: each
// emits a translated reason key so the UI can tell the user why today's
// weighting differs. A black-box adaptive weighting nobody can interrogate
// would be worse than the static one it replaced.
//
// Guardrails: every multiplier is clamped, the product per factor is capped,
// and scoring falls back to base weights if modulation somehow zeroes
// everything out. Modulation can reshape the balance between factors; it
// can't hand any single one unbounded control of the score.
import type { Mode, SunMoonData, WeatherHour, WeightModifier } from "@fishmap/types";
import { clamp, interpolateCurve } from "./curve.js";
import { chopIndex, lightAttenuation, shoreWindRelation, sumPrecip, turbidityIndex, type ShoreRelation } from "./factors.js";
import { VETO_LIMITS } from "./vetoes.js";

/** Per-modifier bounds. A single rule can roughly halve or double a factor's
 * say, never silence it outright or let it run away. */
const MIN_MULTIPLIER = 0.15;
const MAX_MULTIPLIER = 2;

/** Cap on the *product* of every rule hitting one factor, so three
 * independently reasonable boosts can't compound into a de-facto veto. */
export const MAX_COMBINED_MULTIPLIER = 2.5;
export const MIN_COMBINED_MULTIPLIER = 0.12;

/** Factor notes that mean "this factor has nothing to say" — it returned a
 * neutral placeholder score rather than a graded one. Weighting those at
 * full strength is how a point with no marine coverage used to pull its
 * whole score toward a flat 42. */
const NO_SIGNAL_NOTE_KEYS = new Set(["pressure.noHistory"]);

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function mod(
  factorKey: string,
  multiplier: number,
  reasonKey: string,
  params?: Record<string, number | string>,
): WeightModifier {
  return {
    factorKey,
    multiplier: Math.round(clamp(multiplier, MIN_MULTIPLIER, MAX_MULTIPLIER) * 100) / 100,
    reasonKey,
    params,
  };
}

/** Everything the weighting rules are allowed to look at, derived once per
 * scored hour. Deliberately a flat snapshot rather than the raw series — it
 * keeps each rule a pure, testable function of named conditions. */
export interface ScoringContext {
  mode: Mode;
  isNight: boolean;
  /** 0 (blazing clear) to 1 (no light gradient), or undefined with no data. */
  attenuation?: number;
  /** 0 (gin clear) to 1 (chocolate milk). */
  turbid: number;
  pressureDelta3h?: number;
  pressureDelta6h?: number;
  /** Same hour yesterday vs. now — diurnal cycle cancels out, so what's left
   * is genuine airmass change rather than "it's evening." */
  airTempDelta24h?: number;
  sst?: number;
  sstDelta48h?: number;
  precipNow?: number;
  precip6h: number;
  windSpeed?: number;
  waveHeight?: number;
  moonIllumination: number;
  /** Wind's relation to the coastline — undefined without a segment aspect,
   * which is the normal case today (see factors.ts §4.2). */
  windRelation?: ShoreRelation;
  currentRelationKnown: boolean;
}

export function deriveContext(
  hourly: WeatherHour[],
  index: number,
  sunMoon: SunMoonData,
  mode: Mode,
  aspectDeg?: number,
): ScoringContext {
  const wx = hourly[index]!;
  const pressure = wx.pressureMsl;
  const at3h = index >= 3 ? hourly[index - 3]?.pressureMsl : undefined;
  const at6h = index >= 6 ? hourly[index - 6]?.pressureMsl : undefined;
  const temp24hAgo = index >= 24 ? hourly[index - 24]?.temperature2m : undefined;
  const sst48hAgo = index >= 48 ? hourly[index - 48]?.seaSurfaceTemperature : undefined;

  return {
    mode,
    isNight: wx.isDay === 0,
    attenuation: lightAttenuation(wx),
    turbid: turbidityIndex(hourly, index),
    pressureDelta3h: pressure !== undefined && at3h !== undefined ? pressure - at3h : undefined,
    pressureDelta6h: pressure !== undefined && at6h !== undefined ? pressure - at6h : undefined,
    airTempDelta24h:
      wx.temperature2m !== undefined && temp24hAgo !== undefined ? wx.temperature2m - temp24hAgo : undefined,
    sst: wx.seaSurfaceTemperature,
    sstDelta48h:
      wx.seaSurfaceTemperature !== undefined && sst48hAgo !== undefined
        ? wx.seaSurfaceTemperature - sst48hAgo
        : undefined,
    precipNow: wx.precipitation,
    precip6h: sumPrecip(hourly, index, 6),
    windSpeed: wx.windSpeed10m,
    waveHeight: wx.waveHeight,
    moonIllumination: sunMoon.moon.illumination,
    windRelation: shoreWindRelation(wx, aspectDeg),
    currentRelationKnown: aspectDeg !== undefined && wx.oceanCurrentDirection !== undefined,
  };
}

// --- Rule 1: light's weight tracks how much light is actually in play -------
// The headline rule, and the one the whole feature was asked for. Cover on
// the water — cloud, chop, suspended sediment — is what decouples fish
// behaviour from the clock. Under a heavy deck, the midday penalty and the
// dawn bonus both shrink toward nothing, so light should stop dominating and
// let pressure, current and season decide the day. Under a hard clear sky
// over glassy, gin-clear water, the opposite: the diel cycle is at its
// sharpest and time of day deserves *more* than its usual say.
//
// Onshore wind nudges cover up (churn, foam, stirred sediment, a broken
// surface) and offshore nudges it down (it flattens and clears the nearshore
// water, leaving fish exposed and spooky in daylight). Dormant until a
// coastline aspect exists — see factors.ts §4.2.
//
// Spearfishing inverts the whole rule rather than opting out. A spearo's
// "light" factor isn't about fish appetite, it's about whether they can see
// anything at all, so gloom makes light *more* decisive, not less — and it
// compounds with turbidity instead of being softened by it.
function lightCoverRule(ctx: ScoringContext): WeightModifier | null {
  if (ctx.attenuation === undefined) return null;

  if (ctx.mode === "spearfishing") {
    const gloom = clamp(ctx.attenuation * 0.6 + ctx.turbid * 0.4, 0, 1);
    const multiplier = interpolateCurve(gloom, [
      [0, 0.9],
      [0.4, 1],
      [0.8, 1.25],
      [1, 1.35],
    ]);
    if (Math.abs(multiplier - 1) < 0.06) return null;
    return mod("light", multiplier, multiplier > 1 ? "lightCriticalForDiver" : "lightAmpleForDiver", {
      pct: Math.round(gloom * 100),
    });
  }

  // At night there is no sun to attenuate — cloud cover says nothing about
  // how much the hour matters, so the rule simply doesn't apply.
  if (ctx.isNight) return null;

  let cover = clamp(ctx.attenuation * 0.72 + ctx.turbid * 0.28, 0, 1);
  if (ctx.windRelation === "onshore") cover = clamp(cover + 0.1, 0, 1);
  if (ctx.windRelation === "offshore") cover = clamp(cover - 0.1, 0, 1);

  const multiplier = interpolateCurve(cover, [
    [0, 1.15],
    [0.3, 1],
    [0.65, 0.72],
    [1, 0.5],
  ]);
  if (Math.abs(multiplier - 1) < 0.06) return null;
  return mod("light", multiplier, multiplier < 1 ? "lightMutedByCover" : "lightSharpenedByGlare", {
    pct: Math.round(cover * 100),
  });
}

// --- Rule 2: pressure only earns its top weight when it's doing something ---
// Pressure is the highest-weighted factor for shore/boat on the strength of
// tagging studies where it out-predicted everything else — but what those
// studies actually found predictive was pressure *change* around a front,
// not a barometer reading. On a flat midsummer Aegean day sitting at 1015
// hPa for a week, "stable" is not a weak signal, it's the absence of one,
// and handing it 24% of the score is 24% of the number carrying no
// information. Conversely when the barometer is genuinely moving — doubly so
// when a 24h air-temperature drop confirms a real airmass change rather than
// a passing wobble — it deserves more than its standing weight.
function pressureSignalRule(ctx: ScoringContext): WeightModifier | null {
  const { pressureDelta3h: d3, pressureDelta6h: d6 } = ctx;
  if (d3 === undefined || d6 === undefined) return null;

  const cooling = ctx.airTempDelta24h !== undefined && ctx.airTempDelta24h <= -3;
  const moving = Math.abs(d6) >= 2.5 || Math.abs(d3) >= 2;

  if (moving && cooling) return mod("pressure", 1.5, "pressureFrontConfirmed", { delta: round1(d6) });
  if (moving) return mod("pressure", 1.35, "pressureFrontActive", { delta: round1(d6) });
  if (cooling && Math.abs(d6) >= 1) return mod("pressure", 1.25, "pressureAirmassShift", { delta: round1(d6) });
  if (Math.abs(d6) < 0.6 && !cooling) return mod("pressure", 0.55, "pressureStagnant", { delta: round1(d6) });
  return null;
}

// --- Rule 3: after dark, different variables are in charge ------------------
// The lunar term is the app's most contested factor (see factors.ts §4.9) and
// is deliberately held to a low weight — but the contested part is the
// solunar-table claim that moon transits time fish activity. At night the
// moon stops being astrology and becomes the light source: illumination
// decides whether fish feed shallow in darkness or hold high in a lit water
// column. That's a real, measured lighting variable, so it earns more weight
// after sunset than it ever should during the day.
//
// Water clarity moves the other way overnight: fish hunting in the dark are
// working off lateral line and scent rather than sight, so how far light
// carries through the water matters much less than it does at noon.
function nightRules(ctx: ScoringContext): WeightModifier[] {
  if (!ctx.isNight || ctx.mode === "spearfishing") return [];
  const multiplier = interpolateCurve(ctx.moonIllumination, [
    [0, 1.15],
    [0.5, 1.3],
    [1, 1.45],
  ]);
  return [
    mod("solunar", multiplier, "solunarNightMoon", { pct: Math.round(ctx.moonIllumination * 100) }),
    mod("turbidity", 0.75, "turbidityLessAtNight"),
  ];
}

// --- Rule 4: rain is the exception, not the baseline ------------------------
// Precipitation reads 0.0 mm for the overwhelming majority of Greek hours.
// A variable that is at its neutral value nearly all the time contributes
// almost nothing but still consumed a fixed 5% of every score; when it
// finally does rain, that same 5% understates a genuinely strong signal.
function precipitationSignalRule(ctx: ScoringContext): WeightModifier | null {
  if (ctx.precipNow === undefined) return null;
  if (ctx.precipNow >= 0.1) return mod("precipitation", 1.3, "precipActive", { mm: round1(ctx.precipNow) });
  if (ctx.precip6h < 0.2) return mod("precipitation", 0.5, "precipQuiet");
  return null;
}

// --- Rule 5: sea temperature matters when it's moving or extreme ------------
// The factor itself already leans on the 48h delta when it has one and falls
// back to a shallow absolute-value curve when it doesn't. That fallback spans
// barely 20 points across the entire realistic Aegean range, so at a fixed
// 10% weight it's mostly noise — unless the water is genuinely outside the
// band fish are comfortable in, where the absolute number is the whole story.
function seaTempSignalRule(ctx: ScoringContext): WeightModifier | null {
  if (ctx.sst === undefined) return null;
  if (ctx.sstDelta48h !== undefined && Math.abs(ctx.sstDelta48h) >= 1) {
    return mod("seaTemp", 1.3, "seaTempShifting", { delta: round1(ctx.sstDelta48h) });
  }
  if (ctx.sst < 15 || ctx.sst > 26) return mod("seaTemp", 1.2, "seaTempExtreme", { sst: round1(ctx.sst) });
  if (ctx.sstDelta48h !== undefined) return mod("seaTemp", 0.7, "seaTempFlat");
  return null;
}

// --- Rule 6: a known wind/current direction is a better-informed factor -----
// Speed-only wind scoring is an average over an unknown direction. Once the
// coastline aspect is known, the same speed becomes a much sharper claim —
// 15 km/h onshore and 15 km/h offshore are different days — so the factor
// has earned more influence. Dormant in the running app (nothing supplies
// aspectDeg today), same as the direction-aware curves it pairs with.
function directionResolvedRules(ctx: ScoringContext): WeightModifier[] {
  if (ctx.mode === "spearfishing") return [];
  const out: WeightModifier[] = [];
  if (ctx.windRelation !== undefined && ctx.windRelation !== "cross") {
    out.push(mod("wind", 1.2, "windDirectionResolved", { relation: ctx.windRelation }));
  }
  if (ctx.currentRelationKnown) out.push(mod("current", 1.15, "currentDirectionResolved"));
  return out;
}

// --- Rule 7: near the safety limit, safety stops being one factor of ten ----
// A 43 km/h shore wind is one gust short of the veto. It scores badly, but at
// an ordinary 15% weight a good dawn and a falling barometer could still drag
// the composite into "Fair" — which is exactly the hour someone shouldn't be
// standing on wet rocks. Above the limit the veto clamps the score outright;
// this covers the approach, where the number should already be dominated by
// the thing that's about to become dangerous.
function nearLimitRules(ctx: ScoringContext): WeightModifier[] {
  const limits = VETO_LIMITS[ctx.mode];
  const out: WeightModifier[] = [];
  if (ctx.windSpeed !== undefined && ctx.windSpeed >= limits.wind * 0.8 && ctx.windSpeed <= limits.wind) {
    out.push(mod("wind", 1.35, "windNearLimit", { speed: Math.round(ctx.windSpeed) }));
  }
  if (ctx.waveHeight !== undefined && ctx.waveHeight >= limits.wave * 0.8 && ctx.waveHeight <= limits.wave) {
    out.push(mod("waves", 1.35, "wavesNearLimit", { wave: round1(ctx.waveHeight) }));
  }
  return out;
}

/** All condition-driven weight adjustments for one hour. The "this factor
 * has no data" adjustment is not here — it depends on a factor's own output
 * rather than on the weather, and is applied in score.ts. */
export function buildWeightModifiers(ctx: ScoringContext): WeightModifier[] {
  return [
    lightCoverRule(ctx),
    pressureSignalRule(ctx),
    precipitationSignalRule(ctx),
    seaTempSignalRule(ctx),
    ...nightRules(ctx),
    ...directionResolvedRules(ctx),
    ...nearLimitRules(ctx),
  ].filter((m): m is WeightModifier => m !== null);
}

/** Rule 8, applied per factor rather than per hour: a factor that reported
 * "no data" returns a neutral placeholder score, and averaging that in at
 * full weight is how a spot with no marine coverage used to drag its whole
 * score toward a flat mid-40s. Weighted down to a token share rather than
 * zero so the factor still appears in the breakdown with its explanation. */
export function noDataModifier(factorKey: string, noteKey: string): WeightModifier | null {
  if (!noteKey.endsWith(".noData") && !NO_SIGNAL_NOTE_KEYS.has(noteKey)) return null;
  return mod(factorKey, 0.15, "factorNoData");
}

/** Base weight → effective weight, with the per-factor product capped. */
export function effectiveWeight(baseWeight: number, modifiers: WeightModifier[]): number {
  if (modifiers.length === 0) return baseWeight;
  const product = modifiers.reduce((acc, m) => acc * m.multiplier, 1);
  const capped = clamp(product, MIN_COMBINED_MULTIPLIER, MAX_COMBINED_MULTIPLIER);
  return Math.round(baseWeight * capped * 100) / 100;
}
