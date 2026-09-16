import type { Mode, VetoInfo, WeatherHour } from "@fishmap/types";

// WMO weather codes for thunderstorm (Open-Meteo weather_code).
const THUNDERSTORM_CODES = new Set([95, 96, 99]);

/** Hard safety limits per mode. Exported because modulation.ts weights wind
 * and waves up as conditions approach these — a 43 km/h shore wind is one
 * gust short of unfishable and shouldn't be quietly averaged away at its
 * ordinary 15% share, but it also isn't a veto yet. */
export const VETO_LIMITS: Record<Mode, { wind: number; wave: number }> = {
  shore: { wind: 45, wave: 1.5 },
  boat: { wind: 30, wave: 2 },
  spearfishing: { wind: 20, wave: 0.5 },
};

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

  const limits = VETO_LIMITS[mode];
  const modeKey = mode === "spearfishing" ? "spear" : mode;

  const wind = wx.windSpeed10m;
  if (wind !== undefined && wind > limits.wind) {
    const w = Math.round(wind);
    const note =
      mode === "shore"
        ? `Wind too strong for shore safety (${w} km/h).`
        : mode === "boat"
          ? `Wind too strong for a boat outing (${w} km/h).`
          : `Wind too strong for safe spearfishing (${w} km/h).`;
    vetoes.push({ key: `wind.${modeKey}`, note, params: { wind: w } });
  }

  const wave = wx.waveHeight;
  if (wave !== undefined && wave > limits.wave) {
    const h = Math.round(wave * 10) / 10;
    const note =
      mode === "shore"
        ? `Waves too high for shore safety (${h} m).`
        : mode === "boat"
          ? `Waves too high for a safe boat trip (${h} m).`
          : `Waves too high for spearfishing safety/visibility (${h} m).`;
    vetoes.push({ key: `wave.${modeKey}`, note, params: { wave: h } });
  }

  return vetoes;
}
