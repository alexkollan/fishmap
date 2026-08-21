// Pure scoring functions (DEV_PLAN.md §4, §10). Both the web worker/inline
// scorer and the notification cron import from this package — there must
// never be two implementations of the score.
export { clamp, interpolateCurve } from "./curve.js";
export { isWithinDawnWindow, isWithinDuskWindow } from "./time.js";
export { getSunTimes, getMoonData, getSolunarWindows, getSunMoonData } from "./sun.js";
export {
  pressureTrend,
  windRelative,
  waveConditions,
  turbidity,
  seaTempFactor,
  lightWindow,
  precipitationFactor,
  solunarFactor,
  currentFactor,
  seasonality,
  describeMoonPhase,
  type RawFactor,
} from "./factors.js";
export { checkVetoes } from "./vetoes.js";
export { DEFAULT_WEIGHT_PROFILES } from "./weights.js";
export { scoreHour } from "./score.js";
