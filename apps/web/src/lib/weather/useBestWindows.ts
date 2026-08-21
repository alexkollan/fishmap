import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { ActiveLocation, FactorScore, Mode } from "@fishmap/types";
import { getSunMoonData, scoreHour } from "@fishmap/scoring";
import { useWeightProfiles } from "@/lib/weightProfiles";
import { fetchWeather } from "./client";

export interface WindowEntry {
  location: ActiveLocation;
  time: string;
  score: number;
  topFactor: FactorScore | null;
}

const MIN_GAP_MS = 3 * 60 * 60 * 1000;

/**
 * "Best windows" (DEV_PLAN.md §6.6): scans the full fetched series across
 * every given location and ranks the top opportunities. Reuses the same
 * `scoreHour` every other page calls — no second scoring implementation.
 */
export function useBestWindows(locations: ActiveLocation[], mode: Mode, limit = 10) {
  const weightProfiles = useWeightProfiles();
  const results = useQueries({
    queries: locations.map((loc) => ({
      queryKey: ["weather", loc.lat, loc.lon],
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchWeather(loc.lat, loc.lon, signal),
      staleTime: 5 * 60_000,
    })),
  });

  const windows = useMemo<WindowEntry[]>(() => {
    const all: WindowEntry[] = [];
    const nowMs = Date.now();

    results.forEach((r, i) => {
      const series = r.data;
      const loc = locations[i];
      if (!series || !loc) return;

      const sunMoonByDate = new Map<string, ReturnType<typeof getSunMoonData>>();
      series.hourly.forEach((hour, index) => {
        if (new Date(hour.time).getTime() < nowMs) return;
        const dateKey = hour.time.slice(0, 10);
        let sunMoon = sunMoonByDate.get(dateKey);
        if (!sunMoon) {
          sunMoon = getSunMoonData(new Date(hour.time), series.latitude, series.longitude);
          sunMoonByDate.set(dateKey, sunMoon);
        }
        const result = scoreHour(series.hourly, index, sunMoon, mode, weightProfiles[mode]);
        if (result.vetoes.length > 0) return;
        const topFactor = [...result.factors].sort((a, b) => Math.abs(b.score - 50) * b.weight - Math.abs(a.score - 50) * a.weight)[0] ?? null;
        all.push({ location: loc, time: hour.time, score: result.score, topFactor });
      });
    });

    all.sort((a, b) => b.score - a.score);

    const picked: WindowEntry[] = [];
    for (const w of all) {
      const tooClose = picked.some(
        (p) => p.location.lat === w.location.lat && p.location.lon === w.location.lon && Math.abs(Date.parse(p.time) - Date.parse(w.time)) < MIN_GAP_MS,
      );
      if (!tooClose) picked.push(w);
      if (picked.length >= limit) break;
    }
    return picked;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map((r) => r.dataUpdatedAt).join(","), locations, mode, weightProfiles, limit]);

  return { windows, isLoading: results.some((r) => r.isLoading) };
}
