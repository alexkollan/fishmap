// Pure per-factor scoring functions (DEV_PLAN.md §4). Each returns a raw
// {key, score, note, noteKey, noteParams} — weighting is applied once,
// centrally, in score.ts from the active WeightProfile, so a factor never
// has to know how important it is, only how to grade the condition it's
// given.
//
// `note` is an English fallback for non-UI consumers (logs, notification
// bodies). The web UI renders `noteKey`/`noteParams` through
// apps/web/src/lib/i18n/renderFactorNote.ts instead, against
// Dictionary.factorNotes, so every note is fully bilingual — see
// PROGRESS.md for why this indirection exists (the note text used to be
// English-only).
import type { Mode, SunMoonData, SunTimes, WeatherHour } from "@fishmap/types";
import { clamp, interpolateCurve } from "./curve.js";
import {
  DAWN_AFTER_MIN,
  DAWN_BEFORE_MIN,
  DUSK_AFTER_MIN,
  DUSK_BEFORE_MIN,
  isWithinDawnWindow,
  isWithinDuskWindow,
} from "./time.js";

export interface RawFactor {
  key: string;
  score: number;
  note: string;
  noteKey: string;
  noteParams?: Record<string, number | string>;
}

function factor(key: string, score: number, note: string, noteKey: string, noteParams?: Record<string, number | string>): RawFactor {
  return { key, score: Math.round(clamp(score, 0, 100)), note, noteKey, noteParams };
}

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const KMH_PER_KNOT = 1.852;

// --- 4.1 Barometric pressure ----------------------------------------------
// Controlled studies (Peterson 1972 on rainbow trout; Guy et al. 1992 on
// black crappie via ultrasonic tag) found pressure predicted activity better
// than temperature, turbidity, wind, cloud cover, or precipitation — even
// though fish likely can't sense a few hPa directly (trivial next to the
// pressure swings of a normal depth change). The leading theory is that
// pressure is a proxy for the approaching front's other effects rather than
// a direct trigger. Empirically predictive either way — worth the highest
// weight for shore/boat, near-zero for spearfishing (appetite-driven, not
// visibility-driven).

// Recalibrated 2026-08-22 against live feedback: the original curve made
// "merely stable" (delta6h=0) score 68 — nearly "very good" — for a factor
// that's supposed to be the single strongest predictor. A day with no
// pressure signal either way is unremarkable, not good; only a genuine
// falling trend should score well here. See PROGRESS.md's scoring
// recalibration note for the full before/after rationale.
function pressureCurveScore(delta3h: number, delta6h: number, absolute: number): number {
  if (delta3h >= 2) return 15; // sharp post-frontal rise — the worst omen

  const base = interpolateCurve(delta6h, [
    [-6, 100],
    [-2, 85],
    [-1, 68],
    [0, 50],
    [1, 35],
    [3, 18],
  ]);

  if (absolute < 1005) return Math.min(base, 25); // storm-adjacent
  if (absolute > 1022 && Math.abs(delta6h) < 0.5) return Math.min(base, 38); // stable high, lethargic
  return base;
}

export function pressureTrend(hourly: WeatherHour[], index: number): RawFactor {
  const current = hourly[index]?.pressureMsl;
  if (current === undefined) {
    return factor("pressure", 42, "No pressure data available.", "pressure.noData");
  }
  const at3h = index >= 3 ? hourly[index - 3]?.pressureMsl : undefined;
  const at6h = index >= 6 ? hourly[index - 6]?.pressureMsl : undefined;
  if (at3h === undefined || at6h === undefined) {
    return factor("pressure", 50, "Not enough history yet — treating pressure as stable.", "pressure.noHistory");
  }

  const delta3h = current - at3h;
  const delta6h = current - at6h;
  const score = pressureCurveScore(delta3h, delta6h, current);

  if (delta3h >= 2) {
    return factor(
      "pressure",
      score,
      `Rising sharply (+${delta3h.toFixed(1)} hPa/3h) — classic post-front slump, give it 24-36h.`,
      "pressure.risingSharp",
      { delta: Math.round(delta3h * 10) / 10 },
    );
  }
  if (delta6h <= -1) {
    return factor("pressure", score, `Falling (${delta6h.toFixed(1)} hPa/6h) — front approaching, fish are loading up.`, "pressure.falling", {
      delta: Math.round(delta6h * 10) / 10,
    });
  }
  if (delta6h >= 1) {
    return factor("pressure", score, `Rising (${delta6h.toFixed(1)} hPa/6h) — activity easing off.`, "pressure.rising", {
      delta: Math.round(delta6h * 10) / 10,
    });
  }
  return factor("pressure", score, `Stable (${delta6h.toFixed(1)} hPa/6h).`, "pressure.stable", { delta: Math.round(delta6h * 10) / 10 });
}

// --- 4.2 Wind ---------------------------------------------------------------
// Speed-only until a coastline segment can supply its facing bearing
// (`aspectDeg`, precomputed by tools/coastline-pipeline — seaward normal of
// the segment). The map passes it in; single-point pages (no segment) don't
// and fall back to speed-only scoring, same as before.

function shoreWindScore(speedKmh: number, isDay: boolean): number {
  if (speedKmh < 5) return isDay ? 35 : 55;
  return interpolateCurve(speedKmh, [
    [5, 60],
    [12, 95],
    [20, 80],
    [35, 55],
    [45, 25],
  ]);
}

function boatWindScore(speedKmh: number): number {
  // Recalibrated 2026-08-22: dead calm is comfortable but not itself a
  // reason to expect good fishing — the old 85 floor made "no wind at all"
  // read as nearly excellent regardless of anything else.
  return interpolateCurve(speedKmh, [
    [0, 55],
    [15, 92],
    [25, 65],
    [30, 38],
    [40, 15],
  ]);
}

function spearWindScore(speedKmh: number): number {
  return interpolateCurve(speedKmh, [
    [0, 100],
    [10, 85],
    [20, 40],
    [25, 15],
  ]);
}

/** Circular difference between wind "from" bearing and the shore's seaward
 * aspect, 0-180°. ~0° = wind blowing from the sea toward land = onshore.
 * ~180° = wind blowing from land toward the sea = offshore. ~90° = cross-shore. */
function windShoreAngle(windFromDeg: number, aspectDeg: number): number {
  const diff = Math.abs(((windFromDeg - aspectDeg + 540) % 360) - 180);
  return 180 - diff;
}

export type ShoreRelation = "onshore" | "cross" | "offshore";

function classifyRelation(angle: number): ShoreRelation {
  if (angle <= 45) return "onshore";
  if (angle >= 135) return "offshore";
  return "cross";
}

/** The wind's relation to this spot's coastline, or undefined when either
 * the segment aspect or the wind direction is missing (the normal case
 * today — see the aspectDeg note above). Exported for modulation.ts, which
 * treats onshore churn as cover on the water and offshore flattening as the
 * opposite. */
export function shoreWindRelation(wx: WeatherHour, aspectDeg?: number): ShoreRelation | undefined {
  if (aspectDeg === undefined || wx.windDirection10m === undefined) return undefined;
  return classifyRelation(windShoreAngle(wx.windDirection10m, aspectDeg));
}

// DEV_PLAN.md §4.2: onshore 8-20 km/h is the best case, offshore flattens
// the water, and the veto thresholds (checked separately in vetoes.ts) are
// direction-dependent — onshore gets dangerous far sooner than offshore.
function shoreWindScoreWithAspect(speedKmh: number, relation: ShoreRelation, isDay: boolean): number {
  if (speedKmh < 5) return isDay ? 35 : 55;
  if (relation === "onshore") {
    return interpolateCurve(speedKmh, [
      [5, 65],
      [8, 90],
      [14, 100],
      [20, 90],
      [35, 50],
      [45, 20],
    ]);
  }
  if (relation === "offshore") {
    return interpolateCurve(speedKmh, [
      [5, 55],
      [15, 50],
      [30, 40],
      [45, 25],
    ]);
  }
  return interpolateCurve(speedKmh, [
    [5, 60],
    [12, 85],
    [20, 75],
    [35, 50],
    [45, 20],
  ]);
}

export function windRelative(wx: WeatherHour, mode: Mode, aspectDeg?: number): RawFactor {
  const speed = wx.windSpeed10m;
  if (speed === undefined) return factor("wind", 42, "No wind data available.", "wind.noData");

  const speedParam = Math.round(speed);

  if (mode === "boat") {
    const score = boatWindScore(speed);
    const key = score >= 85 ? "wind.boat.calm" : score >= 60 ? "wind.boat.workable" : "wind.boat.rough";
    return factor("wind", score, `${speed.toFixed(0)} km/h.`, key, { speed: speedParam });
  }

  if (mode === "spearfishing") {
    const score = spearWindScore(speed);
    const key = score >= 80 ? "wind.spear.flat" : score >= 40 ? "wind.spear.someChop" : "wind.spear.tooMuchChop";
    return factor("wind", score, `${speed.toFixed(0)} km/h.`, key, { speed: speedParam });
  }

  // shore
  if (aspectDeg === undefined || wx.windDirection10m === undefined) {
    const score = shoreWindScore(speed, wx.isDay !== 0);
    return factor(
      "wind",
      score,
      `${speed.toFixed(0)} km/h. Direction-relative-to-shore scoring needs this spot's coastline aspect.`,
      "wind.shore.speedOnly",
      { speed: speedParam },
    );
  }

  const angle = windShoreAngle(wx.windDirection10m, aspectDeg);
  const relation = classifyRelation(angle);
  const score = shoreWindScoreWithAspect(speed, relation, wx.isDay !== 0);
  const relationKey = speed < 5 ? "wind.shore.calm" : `wind.shore.${relation}`;
  return factor("wind", score, `${speed.toFixed(0)} km/h, ${relation}.`, relationKey, { speed: speedParam });
}

// --- 4.3 Waves --------------------------------------------------------------
// Recalibrated 2026-08-22: 0.2-0.4m chop is the Aegean's default summer
// state, not a special occasion — the old curve maxed out at 90-100 across
// nearly that whole band, which meant "waves" was almost always reading
// as excellent regardless of whether the day actually had anything going
// for it. The peak is narrower now and the common "flat-ish, nothing
// wrong with it" range reads as decent-but-unremarkable (65-80), not
// automatically excellent.

function shoreWaveScore(h: number): number {
  return interpolateCurve(h, [
    [0, 35],
    [0.15, 60],
    [0.3, 78],
    [0.45, 92],
    [0.6, 78],
    [0.9, 55],
    [1.2, 35],
    [1.5, 18],
  ]);
}

function boatWaveScore(h: number): number {
  return interpolateCurve(h, [
    [0, 85],
    [0.3, 92],
    [0.6, 80],
    [1.0, 60],
    [1.5, 35],
    [2.0, 12],
  ]);
}

function spearWaveScore(h: number): number {
  return interpolateCurve(h, [
    [0, 95],
    [0.15, 82],
    [0.3, 55],
    [0.5, 28],
  ]);
}

export function waveConditions(wx: WeatherHour, mode: Mode): RawFactor {
  const h = wx.waveHeight;
  if (h === undefined) return factor("waves", 42, "No wave data available near this point.", "waves.noData");
  const score = mode === "boat" ? boatWaveScore(h) : mode === "spearfishing" ? spearWaveScore(h) : shoreWaveScore(h);
  return factor("waves", score, `${h.toFixed(1)} m wave height.`, "waves.height", { height: Math.round(h * 10) / 10 });
}

// --- 4.4 Turbidity (derived) -------------------------------------------------
// No river-mouth distance or substrate yet (segment-level, Phase 4) —
// modelled from wave height/period and 24h rainfall only.

export function sumPrecip(hourly: WeatherHour[], index: number, hours: number): number {
  let sum = 0;
  for (let i = Math.max(0, index - hours); i < index; i++) sum += hourly[i]?.precipitation ?? 0;
  return sum;
}

/** Wave steepness (height/period) as a 0-1 "surface is broken up" index —
 * the same quantity that drives turbidity, also reused by modulation.ts as
 * one of the things that puts cover on the water. */
export function chopIndex(wx: WeatherHour): number | undefined {
  if (wx.waveHeight === undefined || wx.wavePeriod === undefined) return undefined;
  return clamp((wx.waveHeight / (wx.wavePeriod || 1)) * 3, 0, 1);
}

/** Modelled water turbidity, 0 (gin clear) to 1 (chocolate milk). Exported
 * so modulation.ts weights factors off exactly the same number the
 * turbidity factor grades, rather than a second approximation of it. */
export function turbidityIndex(hourly: WeatherHour[], index: number): number {
  const wx = hourly[index];
  if (!wx) return 0;
  const waveComponent = chopIndex(wx) ?? 0;
  const rainComponent = clamp(sumPrecip(hourly, index, 24) / 20, 0, 1);
  return clamp(waveComponent * 0.6 + rainComponent * 0.4, 0, 1);
}

export function turbidity(hourly: WeatherHour[], index: number, mode: Mode): RawFactor {
  const wx = hourly[index];
  if (!wx) return factor("turbidity", 42, "No data available.", "turbidity.noData");

  const turbid = turbidityIndex(hourly, index);

  // Same input, opposite sign by mode (§4.4): murky is cover for shore/boat
  // predator fishing, catastrophic for spearfishing visibility. Recalibrated
  // 2026-08-22: plain clear water isn't itself a reason to expect a good
  // day for shore/boat, so it no longer reads as a default-positive 60.
  const score =
    mode === "spearfishing"
      ? interpolateCurve(turbid, [
          [0, 95],
          [0.3, 55],
          [0.6, 22],
          [1, 5],
        ])
      : interpolateCurve(turbid, [
          [0, 45],
          [0.3, 68],
          [0.6, 58],
          [1, 32],
        ]);

  const noteKey = turbid < 0.3 ? "turbidity.clear" : turbid < 0.6 ? "turbidity.some" : "turbidity.murky";
  const note = turbid < 0.3 ? "Water likely clear." : turbid < 0.6 ? "Some turbidity expected." : "Likely murky water.";
  return factor("turbidity", score, note, noteKey);
}

// --- 4.5 Sea surface temperature ---------------------------------------------

export function seaTempFactor(hourly: WeatherHour[], index: number): RawFactor {
  const wx = hourly[index];
  const sst = wx?.seaSurfaceTemperature;
  if (sst === undefined) return factor("seaTemp", 42, "No sea temperature data available.", "seaTemp.noData");

  const idx48hAgo = index - 48;
  const sst48hAgo = idx48hAgo >= 0 ? hourly[idx48hAgo]?.seaSurfaceTemperature : undefined;

  if (sst48hAgo !== undefined) {
    const delta = sst - sst48hAgo;
    if (delta <= -2) {
      return factor(
        "seaTemp",
        20,
        `Sea temperature dropped ${Math.abs(delta).toFixed(1)}°C in 48h — bite likely shut down.`,
        "seaTemp.dropped",
        { delta: Math.round(Math.abs(delta) * 10) / 10 },
      );
    }
    if (delta >= 0.5) {
      return factor("seaTemp", 68, `Gently warming (+${delta.toFixed(1)}°C/48h).`, "seaTemp.warming", {
        delta: Math.round(delta * 10) / 10,
      });
    }
  }

  // Recalibrated 2026-08-22: absolute SST alone (no delta signal) is now a
  // genuinely middling contributor — a normal, unremarkable-but-fine
  // summer temperature shouldn't read as a reason the day is "good."
  const score = interpolateCurve(sst, [
    [12, 42],
    [16, 50],
    [22, 55],
    [26, 46],
    [29, 34],
  ]);
  return factor("seaTemp", score, `${sst.toFixed(1)}°C sea surface temperature.`, "seaTemp.value", { sst: Math.round(sst * 10) / 10 });
}

// --- 4.6/4.7 Light window (time-of-day × cloud, multiplicative) -------------

function timeOfDayBase(
  tMs: number,
  sun: SunTimes,
  isDay: 0 | 1 | undefined,
  mode: Mode,
): { score: number; noteKey: string; isLowLightAlready: boolean } {
  if (mode === "spearfishing") {
    const solarNoon = Date.parse(sun.solarNoon);
    const hoursFromNoon = Number.isNaN(solarNoon) ? 6 : Math.abs(tMs - solarNoon) / HOUR_MS;
    const score = interpolateCurve(hoursFromNoon, [
      [0, 100],
      [3, 85],
      [6, 45],
      [9, 15],
    ]);
    return { score, noteKey: "light.spearMidday", isLowLightAlready: false };
  }

  const sunrise = Date.parse(sun.sunrise);
  const sunset = Date.parse(sun.sunset);
  // Recalibrated 2026-08-25: dawn/dusk used to be a flat 100 across the
  // whole window, which — combined with light's high weight — made the app
  // mechanically pick the same ~2.5h block as "best" nearly every day
  // regardless of actual weather (confirmed directly: a real user noticed
  // the pattern before this was caught). Now it peaks at 100 only at the
  // sunrise/sunset instant itself and tapers toward the window edges, so
  // the dawn/dusk signal stays real without steamrolling everything else.
  // Edge values (55) were chosen to roughly continue into whatever the
  // night/daytime curves below already produce just outside the window,
  // rather than introducing a new cliff.
  if (!Number.isNaN(sunrise) && isWithinDawnWindow(tMs, sunrise)) {
    const minutesFromSunrise = (tMs - sunrise) / MINUTE_MS;
    const score = interpolateCurve(minutesFromSunrise, [
      [-DAWN_BEFORE_MIN, 55],
      [0, 100],
      [DAWN_AFTER_MIN, 55],
    ]);
    return { score, noteKey: "light.dawn", isLowLightAlready: true };
  }
  if (!Number.isNaN(sunset) && isWithinDuskWindow(tMs, sunset)) {
    const minutesFromSunset = (tMs - sunset) / MINUTE_MS;
    const score = interpolateCurve(minutesFromSunset, [
      [-DUSK_BEFORE_MIN, 55],
      [0, 100],
      [DUSK_AFTER_MIN, 55],
    ]);
    return { score, noteKey: "light.dusk", isLowLightAlready: true };
  }
  // Recalibrated 2026-08-22: both baselines lowered so "not dawn/dusk"
  // reads as genuinely unremarkable rather than a near-default positive.
  if (isDay === 0) return { score: 52, noteKey: "light.night", isLowLightAlready: true };

  const solarNoon = Date.parse(sun.solarNoon);
  const hoursFromNoon = Number.isNaN(solarNoon) ? 6 : Math.abs(tMs - solarNoon) / HOUR_MS;
  const score = interpolateCurve(hoursFromNoon, [
    [0, 18],
    [3, 35],
    [6, 58],
  ]);
  return { score, noteKey: "light.daytime", isLowLightAlready: false };
}

/** Fraction of top-of-atmosphere sunlight actually reaching the surface,
 * 0-1 — roughly 0.7 under clear Greek sky, 0.15-0.3 under a heavy deck.
 * Undefined at night (both irradiances are 0) and when the radiation
 * variables are missing, in which case callers fall back to cloud cover.
 *
 * Preferred over `cloudCover` wherever it's available: cloud cover is a
 * sky-area percentage that says nothing about how *opaque* the cloud is or
 * how high the sun was behind it, and thin 100% cirrus at noon passes far
 * more light to the water than a 70% storm deck. */
export function atmosphericTransmission(wx: WeatherHour): number | undefined {
  const sw = wx.shortwaveRadiation;
  const toa = wx.terrestrialRadiation;
  if (sw === undefined || toa === undefined || toa < 20) return undefined;
  return clamp(sw / toa, 0, 1);
}

/** 0 (blazing clear midday) to 1 (no usable light gradient at all) — how
 * much the sun is being kept off/out of the water right now. Combines
 * atmospheric attenuation with surface chop scatter; shared by the light
 * factor's score adjustment and by modulation.ts's light weighting so the
 * two can't disagree about how bright the day is. */
export function lightAttenuation(wx: WeatherHour): number | undefined {
  const transmission = atmosphericTransmission(wx);
  const atmos =
    transmission !== undefined
      ? clamp((0.75 - transmission) / 0.6, 0, 1)
      : wx.cloudCover !== undefined
        ? clamp(wx.cloudCover / 100, 0, 1)
        : undefined;
  if (atmos === undefined) return undefined;
  const chop = chopIndex(wx) ?? 0;
  return clamp(atmos * 0.82 + chop * 0.18, 0, 1);
}

export function lightWindow(wx: WeatherHour, sun: SunTimes, mode: Mode): RawFactor {
  const tMs = Date.parse(wx.time);
  const { score: base, noteKey: baseKey, isLowLightAlready } = timeOfDayBase(tMs, sun, wx.isDay, mode);

  let score = base;
  let noteKey = baseKey;
  let note = baseKey.replace("light.", "");

  // Reworked 2026-09-16: was a stepped cloud-cover multiplier topping out at
  // 1.6. Two changes. (1) Continuous, off measured attenuation rather than
  // three cloud-cover buckets, so a marginal cloud deck no longer flips the
  // score by 40% at exactly 60%. (2) Capped lower (1.35), because the score
  // is now only carrying half this job — modulation.ts separately *drops
  // light's weight* under cover. Those are two genuinely different claims:
  // overcast midday really is better light for fishing than clear midday
  // (score), and the whole time-of-day signal is less decisive on a flat
  // grey day (weight). Both at full strength would double-count.
  const attenuation = lightAttenuation(wx);
  if (attenuation !== undefined && mode !== "spearfishing") {
    const multiplier = isLowLightAlready ? 1 + attenuation * 0.08 : interpolateCurve(attenuation, [
      [0, 1],
      [0.25, 1.05],
      [0.6, 1.25],
      [1, 1.35],
    ]);
    score = base * multiplier;
    if (attenuation >= 0.55 && !isLowLightAlready) {
      noteKey = "light.daytimeOvercast";
      note = "Heavy overcast is extending the low-light advantage across the day.";
    }
  }

  return factor("light", score, note, noteKey);
}

// --- 4.8 Precipitation -------------------------------------------------------

export function precipitationFactor(wx: WeatherHour): RawFactor {
  const p = wx.precipitation;
  if (p === undefined) return factor("precipitation", 42, "No precipitation data available.", "precipitation.noData");
  // Recalibrated 2026-08-22: no rain is genuinely neutral, not a reason to
  // expect a good day on its own — the old 65 baseline alone was already
  // inside the "Good" band before any other factor was considered.
  const score = interpolateCurve(p, [
    [0, 48],
    [0.1, 82],
    [2, 82],
    [2.01, 55],
    [8, 55],
    [8.01, 30],
    [20, 15],
  ]);
  return factor("precipitation", score, `${p.toFixed(1)} mm/h.`, "precipitation.value", { mm: Math.round(p * 10) / 10 });
}

// --- 4.9 Moon phase and solunar periods --------------------------------------
// Genuinely contested: a 2023 North American Journal of Fisheries Management
// study found popular solunar tables failed to predict fish activity. The
// well-supported half of "solunar" is dawn/dusk timing itself (§4.6 already
// covers that) — the lunar component specifically stays unproven. Kept at
// moderate-to-low weight everywhere on purpose; the twilight-alignment bonus
// below does most of the real work, not the raw phase score.

export function describeMoonPhase(phase: number): string {
  if (phase < 0.03 || phase > 0.97) return "new";
  if (phase < 0.22) return "waxingCrescent";
  if (phase < 0.28) return "firstQuarter";
  if (phase < 0.47) return "waxingGibbous";
  if (phase < 0.53) return "full";
  if (phase < 0.72) return "waningGibbous";
  if (phase < 0.78) return "lastQuarter";
  return "waningCrescent";
}

// Recalibrated 2026-08-22: solunar windows cover something like a third to
// half of every day (several ~2h major/minor windows per 24h), so the old
// 75/90 bump for merely being inside one made this factor read as "good to
// excellent" far too often to be a meaningful signal. It's contested
// science to begin with (see the note above) — the twilight-aligned case
// stays the one genuinely exceptional signal; a plain active window now
// reads as a modest, not a decisive, bump.
export function solunarFactor(wx: WeatherHour, sunMoon: SunMoonData): RawFactor {
  const tMs = Date.parse(wx.time);
  const activeWindow = sunMoon.solunar.find((w) => tMs >= Date.parse(w.start) && tMs <= Date.parse(w.end));

  const phaseDistanceFromExtreme = Math.min(sunMoon.moon.phase, 1 - sunMoon.moon.phase) * 2; // 0 new/full, 1 quarter
  const phaseScore = interpolateCurve(phaseDistanceFromExtreme, [
    [0, 65],
    [1, 40],
  ]);
  const phaseKey = describeMoonPhase(sunMoon.moon.phase);

  let score = phaseScore;
  if (!activeWindow) {
    return factor("solunar", score, `Moon ${phaseKey}.`, "solunar.phase", { phaseKey });
  }

  score = Math.max(score, activeWindow.type === "major" ? 68 : 55);
  if (activeWindow.alignsWithTwilight) {
    return factor(
      "solunar",
      100,
      `Moon ${phaseKey}. Solunar major period aligns with dawn/dusk right now — the strongest combined signal the app can produce.`,
      "solunar.alignsWithTwilight",
      { phaseKey },
    );
  }
  return factor(
    "solunar",
    score,
    `Moon ${phaseKey}. Active solunar ${activeWindow.type} period.`,
    activeWindow.type === "major" ? "solunar.activeMajor" : "solunar.activeMinor",
    { phaseKey },
  );
}

// --- 4.10 Current -------------------------------------------------------------
// Deliberately mode-dependent, unlike most factors here: for shore/boat,
// moving water beats slack (concentrates bait, §4.10). For spearfishing it's
// the opposite — diver forums consistently name slack tide as when
// visibility peaks and diving is easiest; current stirs sediment and fights
// the diver rather than helping them find fish.
//
// Shore/boat is also direction-relative, same idea as wind (§4.2): current
// only "concentrates bait against the shore" if it's actually moving toward
// the shore. Current pulling straight out to sea does the opposite — nothing
// to pin bait against. Needs a coastline segment's aspectDeg, same as wind;
// speed-only until one is supplied (currently: never — see the aspectDeg
// comment at §4.2, the coastline pipeline is orphaned and nothing calls this
// with a real aspectDeg today, so this branch is dormant, ready for whenever
// coastline data comes back). Spearfishing stays speed-only regardless — the
// slack-water argument is about turbidity/visibility, not direction.
//
// One critical wrinkle vs. wind: Open-Meteo's `ocean_current_direction` uses
// the oceanographic "to" convention (the bearing the current is heading
// *toward*), not meteorological "from" like wind_direction_10m. Onshore
// current is therefore current heading toward the *landward* bearing
// (aspectDeg + 180), not toward aspectDeg itself — do not reuse
// windShoreAngle's "from" math here, it would score onshore/offshore
// backwards.

function shoreOrBoatCurrentScore(knots: number): number {
  return interpolateCurve(knots, [
    [0, 38],
    [0.05, 38],
    [0.2, 85],
    [0.8, 85],
    [2, 45],
    [3, 30],
  ]);
}

// Onshore keeps the full bait-concentration curve above. Offshore and cross
// are dampened, not penalized below the slack baseline — moving water isn't
// harmful for shore/boat, it's just not doing the "pins bait against the
// shore" thing onshore current does.
function shoreOrBoatCurrentScoreOffshore(knots: number): number {
  return interpolateCurve(knots, [
    [0, 38],
    [0.05, 38],
    [0.2, 58],
    [0.8, 58],
    [2, 40],
    [3, 28],
  ]);
}

function shoreOrBoatCurrentScoreCross(knots: number): number {
  return interpolateCurve(knots, [
    [0, 38],
    [0.05, 38],
    [0.2, 70],
    [0.8, 70],
    [2, 42],
    [3, 29],
  ]);
}

/** Circular difference between the current's heading ("to") bearing and the
 * shore's seaward aspect, 0-180°. ~0° = current heading straight onshore
 * (toward land). ~180° = current heading straight offshore (out to sea).
 * ~90° = running parallel to the shore. See the §4.10 comment above for why
 * this can't reuse windShoreAngle's "from"-convention math. */
function currentShoreAngle(currentToDeg: number, aspectDeg: number): number {
  const landwardDeg = (aspectDeg + 180) % 360;
  const diff = Math.abs(((currentToDeg - landwardDeg + 540) % 360) - 180);
  return diff;
}

function spearCurrentScore(knots: number): number {
  return interpolateCurve(knots, [
    [0, 85],
    [0.15, 72],
    [0.4, 38],
    [1, 15],
  ]);
}

export function currentFactor(wx: WeatherHour, mode: Mode, aspectDeg?: number): RawFactor {
  const kmh = wx.oceanCurrentVelocity;
  if (kmh === undefined) return factor("current", 42, "No current data available.", "current.noData");
  const knots = kmh / KMH_PER_KNOT;
  const knotsParam = Math.round(knots * 100) / 100;

  if (mode === "spearfishing") {
    const score = spearCurrentScore(knots);
    return factor(
      "current",
      score,
      `${knots.toFixed(2)} kn current — slack water gives the best visibility and easiest diving.`,
      "current.spear",
      { knots: knotsParam },
    );
  }

  if (aspectDeg === undefined || wx.oceanCurrentDirection === undefined) {
    const score = shoreOrBoatCurrentScore(knots);
    return factor(
      "current",
      score,
      `${knots.toFixed(2)} kn current. Direction-relative-to-shore scoring needs this spot's coastline aspect.`,
      "current.speedOnly",
      { knots: knotsParam },
    );
  }

  const angle = currentShoreAngle(wx.oceanCurrentDirection, aspectDeg);
  const relation = classifyRelation(angle);
  const score =
    relation === "onshore"
      ? shoreOrBoatCurrentScore(knots)
      : relation === "offshore"
        ? shoreOrBoatCurrentScoreOffshore(knots)
        : shoreOrBoatCurrentScoreCross(knots);
  const relationKey = knots < 0.05 ? "current.slack" : `current.${relation}`;
  return factor("current", score, `${knots.toFixed(2)} kn current, ${relation}.`, relationKey, { knots: knotsParam });
}

// --- 4.11 Seasonality (v1: coarse month + SST, no species) -------------------

// Recalibrated 2026-08-22: compressed down ~13-15pts across the board so an
// ordinary month doesn't quietly push every score toward "good" on its own
// — autumn peak and winter trough keep their shape, just off a lower floor.
const MONTH_BASE = [32, 27, 29, 42, 47, 48, 44, 44, 60, 66, 60, 42]; // Jan..Dec

export function seasonality(wx: WeatherHour): RawFactor {
  const date = new Date(wx.time);
  const month = date.getMonth();
  const base = MONTH_BASE[month] ?? 55;
  const sst = wx.seaSurfaceTemperature;
  const score = sst === undefined ? base : clamp(base + (sst >= 16 && sst <= 24 ? 5 : -5), 0, 100);
  const monthName = date.toLocaleDateString("en-US", { month: "long" });
  return factor("seasonality", score, `${monthName} — general Greek coastal fishery activity.`, "seasonality.value", { monthKey: month });
}
