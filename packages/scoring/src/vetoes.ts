import type { Mode, WeatherHour } from "@fishmap/types";

// WMO weather codes for thunderstorm (Open-Meteo weather_code).
const THUNDERSTORM_CODES = new Set([95, 96, 99]);

/** Hard vetoes clamp the score regardless of everything else (DEV_PLAN.md §4).
 * The thunderstorm veto is non-negotiable and never user-overridable. */
export function checkVetoes(wx: WeatherHour, mode: Mode): string[] {
  const vetoes: string[] = [];

  if (wx.weatherCode !== undefined && THUNDERSTORM_CODES.has(wx.weatherCode)) {
    vetoes.push("Thunderstorm risk — lightning and open water/carbon rods don't mix. This veto cannot be overridden.");
  }

  const wind = wx.windSpeed10m;
  if (wind !== undefined) {
    if (mode === "shore" && wind > 45) vetoes.push(`Wind too strong for shore safety (${wind.toFixed(0)} km/h).`);
    if (mode === "boat" && wind > 30) vetoes.push(`Wind too strong for a boat outing (${wind.toFixed(0)} km/h).`);
    if (mode === "spearfishing" && wind > 20) vetoes.push(`Wind too strong for safe spearfishing (${wind.toFixed(0)} km/h).`);
  }

  const wave = wx.waveHeight;
  if (wave !== undefined) {
    if (mode === "shore" && wave > 1.5) vetoes.push(`Waves too high for shore safety (${wave.toFixed(1)} m).`);
    if (mode === "boat" && wave > 2) vetoes.push(`Waves too high for a safe boat trip (${wave.toFixed(1)} m).`);
    if (mode === "spearfishing" && wave > 0.5) vetoes.push(`Waves too high for spearfishing safety/visibility (${wave.toFixed(1)} m).`);
  }

  return vetoes;
}
