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
import { isWithinDawnWindow, isWithinDuskWindow } from "./time.js";

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

function pressureCurveScore(delta3h: number, delta6h: number, absolute: number): number {
  if (delta3h >= 2) return 20; // sharp post-frontal rise — the worst omen

  const base = interpolateCurve(delta6h, [
    [-6, 100],
    [-1, 82],
    [0, 68],
    [1, 55],
    [3, 30],
  ]);

  if (absolute < 1005) return Math.min(base, 30); // storm-adjacent
  if (absolute > 1022 && Math.abs(delta6h) < 0.5) return Math.min(base, 45); // stable high, lethargic
  return base;
}

export function pressureTrend(hourly: WeatherHour[], index: number): RawFactor {
  const current = hourly[index]?.pressureMsl;
  if (current === undefined) {
    return factor("pressure", 50, "No pressure data available.", "pressure.noData");
  }
  const at3h = index >= 3 ? hourly[index - 3]?.pressureMsl : undefined;
  const at6h = index >= 6 ? hourly[index - 6]?.pressureMsl : undefined;
  if (at3h === undefined || at6h === undefined) {
    return factor("pressure", 65, "Not enough history yet — treating pressure as stable.", "pressure.noHistory");
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
  if (speedKmh < 5) return isDay ? 45 : 65;
  return interpolateCurve(speedKmh, [
    [5, 60],
    [12, 95],
    [20, 80],
    [35, 55],
    [45, 25],
  ]);
}

function boatWindScore(speedKmh: number): number {
  return interpolateCurve(speedKmh, [
    [0, 85],
    [15, 100],
    [25, 70],
    [30, 40],
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

type ShoreRelation = "onshore" | "cross" | "offshore";

function classifyRelation(angle: number): ShoreRelation {
  if (angle <= 45) return "onshore";
  if (angle >= 135) return "offshore";
  return "cross";
}

// DEV_PLAN.md §4.2: onshore 8-20 km/h is the best case, offshore flattens
// the water, and the veto thresholds (checked separately in vetoes.ts) are
// direction-dependent — onshore gets dangerous far sooner than offshore.
function shoreWindScoreWithAspect(speedKmh: number, relation: ShoreRelation, isDay: boolean): number {
  if (speedKmh < 5) return isDay ? 45 : 65;
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
  if (speed === undefined) return factor("wind", 50, "No wind data available.", "wind.noData");

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

function shoreWaveScore(h: number): number {
  return interpolateCurve(h, [
    [0, 50],
    [0.2, 90],
    [0.45, 100],
    [0.7, 90],
    [1.2, 60],
    [1.5, 30],
  ]);
}

function boatWaveScore(h: number): number {
  return interpolateCurve(h, [
    [0, 100],
    [0.5, 95],
    [1.0, 75],
    [1.5, 45],
    [2.0, 15],
  ]);
}

function spearWaveScore(h: number): number {
  return interpolateCurve(h, [
    [0, 100],
    [0.2, 90],
    [0.5, 40],
  ]);
}

export function waveConditions(wx: WeatherHour, mode: Mode): RawFactor {
  const h = wx.waveHeight;
  if (h === undefined) return factor("waves", 50, "No wave data available near this point.", "waves.noData");
  const score = mode === "boat" ? boatWaveScore(h) : mode === "spearfishing" ? spearWaveScore(h) : shoreWaveScore(h);
  return factor("waves", score, `${h.toFixed(1)} m wave height.`, "waves.height", { height: Math.round(h * 10) / 10 });
}

// --- 4.4 Turbidity (derived) -------------------------------------------------
// No river-mouth distance or substrate yet (segment-level, Phase 4) —
// modelled from wave height/period and 24h rainfall only.

function sumPrecip(hourly: WeatherHour[], index: number, hours: number): number {
  let sum = 0;
  for (let i = Math.max(0, index - hours); i < index; i++) sum += hourly[i]?.precipitation ?? 0;
  return sum;
}

export function turbidity(hourly: WeatherHour[], index: number, mode: Mode): RawFactor {
  const wx = hourly[index];
  if (!wx) return factor("turbidity", 50, "No data available.", "turbidity.noData");

  const waveComponent =
    wx.waveHeight !== undefined && wx.wavePeriod !== undefined
      ? clamp((wx.waveHeight / (wx.wavePeriod || 1)) * 3, 0, 1)
      : 0;
  const precip24h = sumPrecip(hourly, index, 24);
  const rainComponent = clamp(precip24h / 20, 0, 1);
  const turbid = clamp(waveComponent * 0.6 + rainComponent * 0.4, 0, 1);

  // Same input, opposite sign by mode (§4.4): murky is cover for shore/boat
  // predator fishing, catastrophic for spearfishing visibility.
  const score =
    mode === "spearfishing"
      ? interpolateCurve(turbid, [
          [0, 100],
          [0.3, 60],
          [0.6, 25],
          [1, 5],
        ])
      : interpolateCurve(turbid, [
          [0, 60],
          [0.3, 80],
          [0.6, 70],
          [1, 40],
        ]);

  const noteKey = turbid < 0.3 ? "turbidity.clear" : turbid < 0.6 ? "turbidity.some" : "turbidity.murky";
  const note = turbid < 0.3 ? "Water likely clear." : turbid < 0.6 ? "Some turbidity expected." : "Likely murky water.";
  return factor("turbidity", score, note, noteKey);
}

// --- 4.5 Sea surface temperature ---------------------------------------------

export function seaTempFactor(hourly: WeatherHour[], index: number): RawFactor {
  const wx = hourly[index];
  const sst = wx?.seaSurfaceTemperature;
  if (sst === undefined) return factor("seaTemp", 50, "No sea temperature data available.", "seaTemp.noData");

  const idx48hAgo = index - 48;
  const sst48hAgo = idx48hAgo >= 0 ? hourly[idx48hAgo]?.seaSurfaceTemperature : undefined;

  if (sst48hAgo !== undefined) {
    const delta = sst - sst48hAgo;
    if (delta <= -2) {
      return factor(
        "seaTemp",
        25,
        `Sea temperature dropped ${Math.abs(delta).toFixed(1)}°C in 48h — bite likely shut down.`,
        "seaTemp.dropped",
        { delta: Math.round(Math.abs(delta) * 10) / 10 },
      );
    }
    if (delta >= 0.5) {
      return factor("seaTemp", 75, `Gently warming (+${delta.toFixed(1)}°C/48h).`, "seaTemp.warming", {
        delta: Math.round(delta * 10) / 10,
      });
    }
  }

  const score = interpolateCurve(sst, [
    [12, 55],
    [16, 65],
    [22, 70],
    [26, 60],
    [29, 45],
  ]);
  return factor("seaTemp", score, `${sst.toFixed(1)}°C sea surface temperature.`, "seaTemp.value", { sst: Math.round(sst * 10) / 10 });
}

// --- 4.6/4.7 Light window (time-of-day × cloud, multiplicative) -------------

function timeOfDayBase(tMs: number, sun: SunTimes, isDay: 0 | 1 | undefined, mode: Mode): { score: number; noteKey: string } {
  if (mode === "spearfishing") {
    const solarNoon = Date.parse(sun.solarNoon);
    const hoursFromNoon = Number.isNaN(solarNoon) ? 6 : Math.abs(tMs - solarNoon) / HOUR_MS;
    const score = interpolateCurve(hoursFromNoon, [
      [0, 100],
      [3, 85],
      [6, 45],
      [9, 15],
    ]);
    return { score, noteKey: "light.spearMidday" };
  }

  const sunrise = Date.parse(sun.sunrise);
  const sunset = Date.parse(sun.sunset);
  if (!Number.isNaN(sunrise) && isWithinDawnWindow(tMs, sunrise)) return { score: 100, noteKey: "light.dawn" };
  if (!Number.isNaN(sunset) && isWithinDuskWindow(tMs, sunset)) return { score: 100, noteKey: "light.dusk" };
  if (isDay === 0) return { score: 65, noteKey: "light.night" };

  const solarNoon = Date.parse(sun.solarNoon);
  const hoursFromNoon = Number.isNaN(solarNoon) ? 6 : Math.abs(tMs - solarNoon) / HOUR_MS;
  const score = interpolateCurve(hoursFromNoon, [
    [0, 25],
    [3, 45],
    [6, 75],
  ]);
  return { score, noteKey: "light.daytime" };
}

export function lightWindow(wx: WeatherHour, sun: SunTimes, mode: Mode): RawFactor {
  const tMs = Date.parse(wx.time);
  const { score: base, noteKey: baseKey } = timeOfDayBase(tMs, sun, wx.isDay, mode);

  let score = base;
  let noteKey = baseKey;
  let note = baseKey.replace("light.", "");
  if (wx.cloudCover !== undefined && mode !== "spearfishing") {
    const isLowLightAlready = base >= 65;
    const multiplier = isLowLightAlready
      ? 1 + clamp(wx.cloudCover / 100, 0, 1) * 0.08
      : wx.cloudCover >= 60
        ? 1.6
        : wx.cloudCover >= 20
          ? 1.2
          : 1;
    score = base * multiplier;
    if (wx.cloudCover >= 60 && !isLowLightAlready) {
      noteKey = "light.daytimeOvercast";
      note = "Heavy overcast is extending the low-light advantage across the day.";
    }
  }

  return factor("light", score, note, noteKey);
}

// --- 4.8 Precipitation -------------------------------------------------------

export function precipitationFactor(wx: WeatherHour): RawFactor {
  const p = wx.precipitation;
  if (p === undefined) return factor("precipitation", 65, "No precipitation data available.", "precipitation.noData");
  const score = interpolateCurve(p, [
    [0, 65],
    [0.1, 85],
    [2, 85],
    [2.01, 65],
    [8, 65],
    [8.01, 35],
    [20, 20],
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

export function solunarFactor(wx: WeatherHour, sunMoon: SunMoonData): RawFactor {
  const tMs = Date.parse(wx.time);
  const activeWindow = sunMoon.solunar.find((w) => tMs >= Date.parse(w.start) && tMs <= Date.parse(w.end));

  const phaseDistanceFromExtreme = Math.min(sunMoon.moon.phase, 1 - sunMoon.moon.phase) * 2; // 0 new/full, 1 quarter
  const phaseScore = interpolateCurve(phaseDistanceFromExtreme, [
    [0, 85],
    [1, 60],
  ]);
  const phaseKey = describeMoonPhase(sunMoon.moon.phase);

  let score = phaseScore;
  if (!activeWindow) {
    return factor("solunar", score, `Moon ${phaseKey}.`, "solunar.phase", { phaseKey });
  }

  score = Math.max(score, activeWindow.type === "major" ? 90 : 75);
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

function shoreOrBoatCurrentScore(knots: number): number {
  return interpolateCurve(knots, [
    [0, 45],
    [0.05, 45],
    [0.2, 90],
    [0.8, 90],
    [2, 50],
    [3, 35],
  ]);
}

function spearCurrentScore(knots: number): number {
  return interpolateCurve(knots, [
    [0, 90],
    [0.15, 80],
    [0.4, 45],
    [1, 20],
  ]);
}

export function currentFactor(wx: WeatherHour, mode: Mode): RawFactor {
  const kmh = wx.oceanCurrentVelocity;
  if (kmh === undefined) return factor("current", 50, "No current data available.", "current.noData");
  const knots = kmh / KMH_PER_KNOT;
  const score = mode === "spearfishing" ? spearCurrentScore(knots) : shoreOrBoatCurrentScore(knots);
  const knotsParam = Math.round(knots * 100) / 100;
  if (mode === "spearfishing") {
    return factor(
      "current",
      score,
      `${knots.toFixed(2)} kn current — slack water gives the best visibility and easiest diving.`,
      "current.spear",
      { knots: knotsParam },
    );
  }
  return factor("current", score, `${knots.toFixed(2)} kn current.`, "current.default", { knots: knotsParam });
}

// --- 4.11 Seasonality (v1: coarse month + SST, no species) -------------------

const MONTH_BASE = [45, 40, 42, 55, 60, 62, 58, 58, 75, 80, 75, 55]; // Jan..Dec

export function seasonality(wx: WeatherHour): RawFactor {
  const date = new Date(wx.time);
  const month = date.getMonth();
  const base = MONTH_BASE[month] ?? 55;
  const sst = wx.seaSurfaceTemperature;
  const score = sst === undefined ? base : clamp(base + (sst >= 16 && sst <= 24 ? 5 : -5), 0, 100);
  const monthName = date.toLocaleDateString("en-US", { month: "long" });
  return factor("seasonality", score, `${monthName} — general Greek coastal fishery activity.`, "seasonality.value", { monthKey: month });
}
