import type { Mode, VetoInfo, WeatherHour } from "@fishmap/types";

// WMO weather codes for thunderstorm (Open-Meteo weather_code).
const THUNDERSTORM_CODES = new Set([95, 96, 99]);

/** Hard vetoes clamp the score regardless of everything else (DEV_PLAN.md §4).
 * The thunderstorm veto is non-negotiable and never user-overridable.
 * Returns structured keys (Dictionary.vetoes) instead of plain English so
 * the UI can render them in Greek — `note` is only an English fallback for
 * non-UI consumers. */
export function checkVetoes(wx: WeatherHour, mode: Mode): VetoInfo[] {
  const vetoes: VetoInfo[] = [];

  if (wx.weatherCode !== undefined && THUNDERSTORM_CODES.has(wx.weatherCode)) {
    vetoes.push({
      key: "thunderstorm",
      note: "Thunderstorm risk — lightning and open water/carbon rods don't mix. This veto cannot be overridden.",
    });
  }

  const wind = wx.windSpeed10m;
  if (wind !== undefined) {
    const w = Math.round(wind);
    if (mode === "shore" && wind > 45) vetoes.push({ key: "wind.shore", note: `Wind too strong for shore safety (${w} km/h).`, params: { wind: w } });
    if (mode === "boat" && wind > 30) vetoes.push({ key: "wind.boat", note: `Wind too strong for a boat outing (${w} km/h).`, params: { wind: w } });
    if (mode === "spearfishing" && wind > 20)
      vetoes.push({ key: "wind.spear", note: `Wind too strong for safe spearfishing (${w} km/h).`, params: { wind: w } });
  }

  const wave = wx.waveHeight;
  if (wave !== undefined) {
    const h = Math.round(wave * 10) / 10;
    if (mode === "shore" && wave > 1.5) vetoes.push({ key: "wave.shore", note: `Waves too high for shore safety (${h} m).`, params: { wave: h } });
    if (mode === "boat" && wave > 2) vetoes.push({ key: "wave.boat", note: `Waves too high for a safe boat trip (${h} m).`, params: { wave: h } });
    if (mode === "spearfishing" && wave > 0.5)
      vetoes.push({ key: "wave.spear", note: `Waves too high for spearfishing safety/visibility (${h} m).`, params: { wave: h } });
  }

  return vetoes;
}
