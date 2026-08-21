import { describe, expect, it } from "vitest";
import type { WeatherHour } from "@fishmap/types";
import { getSunMoonData } from "./sun.js";
import { scoreHour } from "./score.js";

function buildHourlySeries(overrides: Partial<WeatherHour> = {}): WeatherHour[] {
  const start = new Date("2026-08-19T00:00:00Z");
  return Array.from({ length: 216 }, (_, i) => {
    const time = new Date(start.getTime() + i * 3_600_000).toISOString();
    const hour = new Date(time).getUTCHours();
    return {
      time,
      temperature2m: 24,
      pressureMsl: 1015,
      windSpeed10m: 12,
      windDirection10m: 90,
      cloudCover: 20,
      precipitation: 0,
      isDay: hour >= 6 && hour <= 19 ? 1 : 0,
      weatherCode: 1,
      waveHeight: 0.4,
      wavePeriod: 5,
      seaSurfaceTemperature: 24,
      oceanCurrentVelocity: 0.5,
      ...overrides,
    } satisfies WeatherHour;
  });
}

const sunMoon = getSunMoonData(new Date("2026-08-19T12:00:00Z"), 37.65, 24.03);

describe("scoreHour", () => {
  it("produces a score within 0-100 for typical calm-day conditions", () => {
    const hourly = buildHourlySeries();
    const result = scoreHour(hourly, 60, sunMoon, "shore");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.vetoes).toHaveLength(0);
    expect(result.factors.length).toBeGreaterThan(0);
  });

  it("clamps the score to <=20 on a thunderstorm veto, non-overridable", () => {
    const hourly = buildHourlySeries({ weatherCode: 95 });
    const result = scoreHour(hourly, 60, sunMoon, "shore");
    expect(result.score).toBeLessThanOrEqual(20);
    expect(result.vetoes.some((v) => v.includes("Thunderstorm"))).toBe(true);
  });

  it("vetoes high wind for shore but not for a calmer threshold mismatch", () => {
    const hourly = buildHourlySeries({ windSpeed10m: 50 });
    const result = scoreHour(hourly, 60, sunMoon, "shore");
    expect(result.vetoes.some((v) => v.includes("Wind too strong"))).toBe(true);
  });

  it("flags missing marine data as a caveat rather than failing", () => {
    const hourly = buildHourlySeries({ waveHeight: undefined, wavePeriod: undefined });
    const result = scoreHour(hourly, 60, sunMoon, "boat");
    expect(result.caveats.some((c) => c.includes("marine data"))).toBe(true);
  });
});
