import { describe, expect, it } from "vitest";
import type { Mode, WeatherHour } from "@fishmap/types";
import { getSunMoonData } from "./sun.js";
import { scoreHour } from "./score.js";

// 2026-08-19, Aegean. Sunrise ~06:45 local (03:45Z), so 13:00Z is solidly
// midday and 21:00Z is solidly night.
const LAT = 37.65;
const LON = 24.03;
const START = new Date("2026-08-17T00:00:00Z");
const sunMoon = getSunMoonData(new Date("2026-08-19T12:00:00Z"), LAT, LON);

/** Clear-sky irradiance shape for the day, used as the baseline both the
 * clear and overcast fixtures are built from. */
function terrestrialAt(hourUtc: number): number {
  const fromNoon = Math.abs(hourUtc - 9.5);
  return Math.max(0, Math.round(1100 * Math.cos((fromNoon / 7.5) * (Math.PI / 2))));
}

function buildSeries(overrides: (hourUtc: number) => Partial<WeatherHour> = () => ({})): WeatherHour[] {
  return Array.from({ length: 216 }, (_, i) => {
    const time = new Date(START.getTime() + i * 3_600_000).toISOString();
    const hourUtc = new Date(time).getUTCHours();
    const toa = terrestrialAt(hourUtc);
    return {
      time,
      temperature2m: 26,
      pressureMsl: 1015,
      windSpeed10m: 12,
      windDirection10m: 90,
      cloudCover: 5,
      precipitation: 0,
      isDay: toa > 0 ? 1 : 0,
      weatherCode: 1,
      waveHeight: 0.4,
      wavePeriod: 5,
      seaSurfaceTemperature: 24,
      oceanCurrentVelocity: 0.5,
      terrestrialRadiation: toa,
      shortwaveRadiation: Math.round(toa * 0.75),
      ...overrides(hourUtc),
    } satisfies WeatherHour;
  });
}

/** Index into the series for a given UTC hour on day 3 (2026-08-19). */
function hourIndex(hourUtc: number): number {
  return 48 + hourUtc;
}

function weightOf(factors: { key: string; weight: number }[], key: string): number {
  return factors.find((f) => f.key === key)!.weight;
}

function baseWeightOf(factors: { key: string; baseWeight: number }[], key: string): number {
  return factors.find((f) => f.key === key)!.baseWeight;
}

describe("contextual weight modulation", () => {
  describe("light weight vs. cloud cover — the headline case", () => {
    const midday = hourIndex(13);

    it("cuts light's weight at midday under heavy overcast, and leaves it alone on a clear day", () => {
      const clear = scoreHour(buildSeries(), midday, sunMoon, "shore");
      const overcast = scoreHour(
        buildSeries((h) => ({ cloudCover: 95, shortwaveRadiation: Math.round(terrestrialAt(h) * 0.18) })),
        midday,
        sunMoon,
        "shore",
      );

      const clearLight = weightOf(clear.factors, "light");
      const overcastLight = weightOf(overcast.factors, "light");
      const base = baseWeightOf(clear.factors, "light");

      // Clear midday: light is at or above its standing weight.
      expect(clearLight).toBeGreaterThanOrEqual(base);
      // Overcast midday: materially less say, not merely a rounding nudge.
      expect(overcastLight).toBeLessThan(base * 0.85);
      expect(overcastLight).toBeLessThan(clearLight * 0.75);
    });

    it("raises the midday score under overcast, because time of day decides less of it", () => {
      const clear = scoreHour(buildSeries(), midday, sunMoon, "shore");
      const overcast = scoreHour(
        buildSeries((h) => ({ cloudCover: 95, shortwaveRadiation: Math.round(terrestrialAt(h) * 0.18) })),
        midday,
        sunMoon,
        "shore",
      );
      expect(overcast.score).toBeGreaterThan(clear.score);
    });

    it("explains the shift with a translatable reason rather than silently reweighting", () => {
      const overcast = scoreHour(
        buildSeries((h) => ({ cloudCover: 95, shortwaveRadiation: Math.round(terrestrialAt(h) * 0.18) })),
        midday,
        sunMoon,
        "shore",
      );
      const reason = overcast.modifiers.find((m) => m.factorKey === "light");
      expect(reason?.reasonKey).toBe("lightMutedByCover");
      expect(reason!.multiplier).toBeLessThan(1);
    });

    it("inverts the rule for spearfishing — gloom makes light more decisive, not less", () => {
      const overcast = scoreHour(
        buildSeries((h) => ({ cloudCover: 95, shortwaveRadiation: Math.round(terrestrialAt(h) * 0.18) })),
        midday,
        sunMoon,
        "spearfishing",
      );
      const light = overcast.factors.find((f) => f.key === "light")!;
      expect(light.weight).toBeGreaterThan(light.baseWeight);
      expect(light.modifiers[0]!.reasonKey).toBe("lightCriticalForDiver");
    });

    it("does not reweight light at night, when there is no sunlight to attenuate", () => {
      const night = hourIndex(21);
      const clear = scoreHour(buildSeries(), night, sunMoon, "shore");
      const overcast = scoreHour(buildSeries(() => ({ cloudCover: 95 })), night, sunMoon, "shore");
      expect(weightOf(clear.factors, "light")).toBe(baseWeightOf(clear.factors, "light"));
      expect(weightOf(overcast.factors, "light")).toBe(baseWeightOf(overcast.factors, "light"));
    });
  });

  describe("pressure weight tracks whether the barometer is saying anything", () => {
    const midday = hourIndex(13);

    it("demotes a flat barometer well below its standing weight", () => {
      const result = scoreHour(buildSeries(), midday, sunMoon, "shore");
      const pressure = result.factors.find((f) => f.key === "pressure")!;
      expect(pressure.weight).toBeLessThan(pressure.baseWeight * 0.7);
      expect(pressure.modifiers[0]!.reasonKey).toBe("pressureStagnant");
    });

    it("promotes it when a front is moving through", () => {
      const falling = buildSeries();
      for (let i = 0; i < falling.length; i++) falling[i]!.pressureMsl = 1020 - i * 0.7;
      const result = scoreHour(falling, midday, sunMoon, "shore");
      const pressure = result.factors.find((f) => f.key === "pressure")!;
      expect(pressure.weight).toBeGreaterThan(pressure.baseWeight);
      expect(pressure.modifiers[0]!.reasonKey).toBe("pressureFrontActive");
    });

    it("promotes it further when a 24h air-temperature drop confirms the airmass change", () => {
      const front = buildSeries();
      for (let i = 0; i < front.length; i++) {
        front[i]!.pressureMsl = 1020 - i * 0.7;
        front[i]!.temperature2m = 30 - i * 0.2;
      }
      const result = scoreHour(front, midday, sunMoon, "shore");
      const pressure = result.factors.find((f) => f.key === "pressure")!;
      expect(pressure.modifiers[0]!.reasonKey).toBe("pressureFrontConfirmed");
      expect(pressure.weight).toBeGreaterThan(pressure.baseWeight * 1.4);
    });
  });

  describe("missing data no longer votes at full weight", () => {
    it("reduces a no-data factor to a token share of the score", () => {
      const noMarine = buildSeries(() => ({
        waveHeight: undefined,
        wavePeriod: undefined,
        seaSurfaceTemperature: undefined,
        oceanCurrentVelocity: undefined,
      }));
      const result = scoreHour(noMarine, hourIndex(13), sunMoon, "boat");
      for (const key of ["waves", "seaTemp", "current"]) {
        const f = result.factors.find((x) => x.key === key)!;
        expect(f.noteKey.endsWith(".noData")).toBe(true);
        expect(f.weight).toBeLessThan(f.baseWeight * 0.2);
        expect(f.modifiers.some((m) => m.reasonKey === "factorNoData")).toBe(true);
      }
    });

    it("keeps the atmospheric-only score from being dragged toward a flat placeholder", () => {
      const build = (marine: boolean) =>
        buildSeries((h) => ({
          // A genuinely good shore dawn: falling barometer, light rain.
          pressureMsl: 1018 - (48 + h) * 0.4,
          precipitation: 0.5,
          ...(marine ? {} : { waveHeight: undefined, wavePeriod: undefined, seaSurfaceTemperature: undefined, oceanCurrentVelocity: undefined }),
        }));
      const withMarine = scoreHour(build(true), hourIndex(4), sunMoon, "shore");
      const withoutMarine = scoreHour(build(false), hourIndex(4), sunMoon, "shore");
      // Without marine data the score should still reflect the strong
      // atmospheric case, not regress toward the neutral 42 placeholders.
      expect(Math.abs(withoutMarine.score - withMarine.score)).toBeLessThan(15);
    });
  });

  describe("safety-adjacent conditions dominate before they become a veto", () => {
    it("weights wind up as it approaches the mode's veto threshold", () => {
      const windy = buildSeries(() => ({ windSpeed10m: 42 }));
      const result = scoreHour(windy, hourIndex(13), sunMoon, "shore");
      const wind = result.factors.find((f) => f.key === "wind")!;
      expect(result.vetoes).toHaveLength(0);
      expect(wind.weight).toBeGreaterThan(wind.baseWeight);
      expect(wind.modifiers.some((m) => m.reasonKey === "windNearLimit")).toBe(true);
    });
  });

  describe("night shifts which variables are in charge", () => {
    it("gives the moon more weight after dark and water clarity less", () => {
      const result = scoreHour(buildSeries(), hourIndex(21), sunMoon, "shore");
      const solunar = result.factors.find((f) => f.key === "solunar")!;
      const turbid = result.factors.find((f) => f.key === "turbidity")!;
      expect(solunar.weight).toBeGreaterThan(solunar.baseWeight);
      expect(solunar.modifiers.some((m) => m.reasonKey === "solunarNightMoon")).toBe(true);
      expect(turbid.weight).toBeLessThan(turbid.baseWeight);
    });
  });

  describe("guardrails", () => {
    const modes: Mode[] = ["shore", "boat", "spearfishing"];

    it("keeps every score in range and every weight non-negative across modes and hours", () => {
      const series = buildSeries((h) => ({
        cloudCover: (h * 7) % 100,
        shortwaveRadiation: Math.round(terrestrialAt(h) * (0.15 + ((h * 13) % 60) / 100)),
        precipitation: h % 5 === 0 ? 1.2 : 0,
        windSpeed10m: 4 + (h % 11) * 3,
      }));
      for (const mode of modes) {
        for (let h = 0; h < 24; h++) {
          const result = scoreHour(series, hourIndex(h), sunMoon, mode);
          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(100);
          for (const f of result.factors) expect(f.weight).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it("caps how far a single factor's weight can be pushed", () => {
      const extreme = buildSeries(() => ({ windSpeed10m: 42, windDirection10m: 90 }));
      const result = scoreHour(extreme, hourIndex(13), sunMoon, "shore", undefined, 90);
      const wind = result.factors.find((f) => f.key === "wind")!;
      expect(wind.modifiers.length).toBeGreaterThan(1);
      expect(wind.weight).toBeLessThanOrEqual(wind.baseWeight * 2.5);
    });
  });
});
