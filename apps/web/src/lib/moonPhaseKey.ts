import type { Dictionary } from "@/lib/i18n/dictionary";

// Mirrors packages/scoring's describeMoonPhase() thresholds but returns a
// dictionary key instead of an English sentence — @fishmap/scoring stays
// UI/i18n-agnostic, this small duplication keeps that boundary clean.
export function moonPhaseKey(phase: number): keyof Dictionary["sunMoon"]["phase"] {
  if (phase < 0.03 || phase > 0.97) return "new";
  if (phase < 0.22) return "waxingCrescent";
  if (phase < 0.28) return "firstQuarter";
  if (phase < 0.47) return "waxingGibbous";
  if (phase < 0.53) return "full";
  if (phase < 0.72) return "waningGibbous";
  if (phase < 0.78) return "lastQuarter";
  return "waningCrescent";
}
