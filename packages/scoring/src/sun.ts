import SunCalc from "suncalc";
import type { MoonData, SolunarWindow, SunMoonData, SunTimes } from "@fishmap/types";
import { isWithinDawnWindow, isWithinDuskWindow, rangesOverlap } from "./time.js";

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

function toIso(d: Date | undefined): string {
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : "";
}

function toIsoOrNull(d: Date | undefined): string | null {
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
}

export function getSunTimes(date: Date, lat: number, lon: number): SunTimes {
  const t = SunCalc.getTimes(date, lat, lon);
  return {
    date: date.toISOString().slice(0, 10),
    sunrise: toIso(t.sunrise),
    sunset: toIso(t.sunset),
    civilDawn: toIso(t.dawn),
    civilDusk: toIso(t.dusk),
    nauticalDawn: toIso(t.nauticalDawn),
    nauticalDusk: toIso(t.nauticalDusk),
    solarNoon: toIso(t.solarNoon),
    goldenHourEveningStart: toIso(t.goldenHour),
    goldenHourMorningEnd: toIso(t.goldenHourEnd),
  };
}

/**
 * Scans moon altitude around `date` to find the transit (upper culmination —
 * moon overhead, solunar "major") and anti-transit (lower culmination —
 * "underfoot", the other solunar "major"). SunCalc doesn't expose these
 * directly, so we sample every 6 minutes across a wide window and keep the
 * first local max/min that falls within the target day.
 */
function findMoonExtrema(date: Date, lat: number, lon: number): { transit: Date | null; antiTransit: Date | null } {
  const stepMs = 6 * MINUTE_MS;
  const scanStart = date.getTime() - 6 * HOUR_MS;
  const scanEnd = date.getTime() + 30 * HOUR_MS;
  const dayStart = date.getTime();
  const dayEnd = dayStart + 24 * HOUR_MS;

  let prevAlt: number | null = null;
  let prevPrevAlt: number | null = null;
  let prevTime = 0;
  let transit: Date | null = null;
  let antiTransit: Date | null = null;

  for (let t = scanStart; t <= scanEnd; t += stepMs) {
    const alt = SunCalc.getMoonPosition(new Date(t), lat, lon).altitude;
    if (prevAlt !== null && prevPrevAlt !== null) {
      const midTime = prevTime;
      const inDay = midTime >= dayStart && midTime < dayEnd;
      if (inDay && !transit && prevAlt > prevPrevAlt && prevAlt > alt) {
        transit = new Date(midTime);
      }
      if (inDay && !antiTransit && prevAlt < prevPrevAlt && prevAlt < alt) {
        antiTransit = new Date(midTime);
      }
    }
    prevPrevAlt = prevAlt;
    prevAlt = alt;
    prevTime = t;
  }

  return { transit, antiTransit };
}

export function getMoonData(date: Date, lat: number, lon: number): MoonData {
  const illum = SunCalc.getMoonIllumination(date);
  const moonTimes = SunCalc.getMoonTimes(date, lat, lon);
  const { transit, antiTransit } = findMoonExtrema(date, lat, lon);

  return {
    moonrise: toIsoOrNull(moonTimes.rise),
    moonset: toIsoOrNull(moonTimes.set),
    phase: illum.phase,
    illumination: illum.fraction,
    transitTime: toIsoOrNull(transit ?? undefined),
    antiTransitTime: toIsoOrNull(antiTransit ?? undefined),
  };
}

function buildWindow(
  type: "major" | "minor",
  centerIso: string | null,
  halfWidthMin: number,
  sun: SunTimes,
): SolunarWindow | null {
  if (!centerIso) return null;
  const center = new Date(centerIso).getTime();
  const start = center - halfWidthMin * MINUTE_MS;
  const end = center + halfWidthMin * MINUTE_MS;

  const sunriseMs = sun.sunrise ? new Date(sun.sunrise).getTime() : NaN;
  const sunsetMs = sun.sunset ? new Date(sun.sunset).getTime() : NaN;
  const alignsWithTwilight =
    (!Number.isNaN(sunriseMs) && rangesOverlap(start, end, sunriseMs - 3_600_000, sunriseMs + 3_600_000) && isWithinDawnWindow(center, sunriseMs)) ||
    (!Number.isNaN(sunsetMs) && rangesOverlap(start, end, sunsetMs - 3_600_000, sunsetMs + 3_600_000) && isWithinDuskWindow(center, sunsetMs));

  return {
    type,
    start: new Date(start).toISOString(),
    center: centerIso,
    end: new Date(end).toISOString(),
    alignsWithTwilight,
  };
}

export function getSolunarWindows(moon: MoonData, sun: SunTimes): SolunarWindow[] {
  const windows = [
    buildWindow("major", moon.transitTime, 60, sun),
    buildWindow("major", moon.antiTransitTime, 60, sun),
    buildWindow("minor", moon.moonrise, 45, sun),
    buildWindow("minor", moon.moonset, 45, sun),
  ].filter((w): w is SolunarWindow => w !== null);

  return windows.sort((a, b) => new Date(a.center).getTime() - new Date(b.center).getTime());
}

export function getSunMoonData(date: Date, lat: number, lon: number): SunMoonData {
  const sun = getSunTimes(date, lat, lon);
  const moon = getMoonData(date, lat, lon);
  const solunar = getSolunarWindows(moon, sun);
  return { sun, moon, solunar };
}
