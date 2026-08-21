import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ActiveLocation, DailyScore, Mode, ScoreResult, SunMoonData, WeatherHour, WeatherSeries } from "@fishmap/types";
import { getSunMoonData, scoreHour } from "@fishmap/scoring";
import { fetchWeather } from "./client";

export interface HourlyConditions {
  hour: WeatherHour;
  result: ScoreResult;
}

export interface ConditionsBundle {
  series: WeatherSeries;
  hours: HourlyConditions[];
  nowIndex: number;
  now: HourlyConditions;
  daily: DailyScore[];
  sunMoonToday: SunMoonData;
}

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

/** A focused window around "now" for the /conditions/* trend charts —
 * distinct from the full 7-day series the Forecast page's day cards use. */
export function chartWindow(hours: HourlyConditions[], nowIndex: number, beforeHours = 12, afterHours = 48): HourlyConditions[] {
  const start = Math.max(0, nowIndex - beforeHours);
  const end = Math.min(hours.length, nowIndex + afterHours);
  return hours.slice(start, end);
}

function findNowIndex(hours: HourlyConditions[]): number {
  const nowMs = Date.now();
  let index = 0;
  for (let i = 0; i < hours.length; i++) {
    if (new Date(hours[i]!.hour.time).getTime() <= nowMs) index = i;
    else break;
  }
  return index;
}

function computeDaily(hours: HourlyConditions[]): DailyScore[] {
  const byDate = new Map<string, HourlyConditions[]>();
  for (const h of hours) {
    const key = dateKey(h.hour.time);
    const list = byDate.get(key);
    if (list) list.push(h);
    else byDate.set(key, [h]);
  }

  const todayKey = dateKey(new Date().toISOString());
  const dates = [...byDate.keys()]
    .filter((d) => d >= todayKey)
    .sort()
    .slice(0, 7);

  return dates.map((date) => {
    const dayHours = byDate.get(date)!;
    let best = dayHours[0]!;
    let minScore = best.result.score;
    for (const h of dayHours) {
      if (h.result.score > best.result.score) best = h;
      minScore = Math.min(minScore, h.result.score);
    }
    return { date, score: best.result.score, minScore, maxScore: best.result.score, bestHour: best.hour.time };
  });
}

/**
 * Single-location conditions: fetch weather, compute sun/moon locally, score
 * every hour inline with the shared @fishmap/scoring functions. No worker —
 * that's only needed for the map's whole-coastline pass (DEV_PLAN.md §5.6).
 */
export function useConditions(location: ActiveLocation, mode: Mode) {
  const query = useQuery({
    queryKey: ["weather", location.lat, location.lon],
    queryFn: ({ signal }) => fetchWeather(location.lat, location.lon, signal),
    staleTime: 5 * 60_000,
  });

  const bundle = useMemo<ConditionsBundle | null>(() => {
    const series = query.data;
    if (!series || series.hourly.length === 0) return null;

    const sunMoonByDate = new Map<string, SunMoonData>();
    for (const hour of series.hourly) {
      const key = dateKey(hour.time);
      if (!sunMoonByDate.has(key)) {
        sunMoonByDate.set(key, getSunMoonData(new Date(hour.time), series.latitude, series.longitude));
      }
    }

    const hours: HourlyConditions[] = series.hourly.map((hour, index) => {
      const sunMoon = sunMoonByDate.get(dateKey(hour.time))!;
      return { hour, result: scoreHour(series.hourly, index, sunMoon, mode) };
    });

    const nowIndex = findNowIndex(hours);
    const sunMoonToday = sunMoonByDate.get(dateKey(hours[nowIndex]!.hour.time))!;

    return {
      series,
      hours,
      nowIndex,
      now: hours[nowIndex]!,
      daily: computeDaily(hours),
      sunMoonToday,
    };
  }, [query.data, mode]);

  return { ...query, bundle };
}
