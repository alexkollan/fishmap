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
  atmosphericTransmission,
  lightAttenuation,
  turbidityIndex,
  chopIndex,
  shoreWindRelation,
  type RawFactor,
  type ShoreRelation,
} from "./factors.js";
export { checkVetoes, VETO_LIMITS } from "./vetoes.js";
export { DEFAULT_WEIGHT_PROFILES } from "./weights.js";
export {
  deriveContext,
  buildWeightModifiers,
  noDataModifier,
  effectiveWeight,
  type ScoringContext,
} from "./modulation.js";
export { scoreHour } from "./score.js";
