import type { Mode, WeightProfile } from "@fishmap/types";

// v1 hypothesis, not truth (DEV_PLAN.md §12) — the Phase 7 live weight
// editor is what tunes these against real outings. Every factor is computed
// for every mode (see score.ts) — nothing is ever skipped. Only the weight
// below, and in a few factors the curve shape itself, changes per mode.
//
// Rationale, cross-checked against outside sources (not just DEV_PLAN §4):
// - Pressure dominates shore/boat: two independent tagging studies found it
//   out-predicts temperature/turbidity/wind/cloud/precip (see factors.ts).
//   Near-zero for spearfishing — appetite doesn't matter if you can't see.
// - Turbidity is spearfishing's single highest weight: diver forums
//   consistently call visibility "paramount"/"everything," ahead even of
//   wave height/safety.
// - Solunar stays modest everywhere: genuinely contested evidence (a 2023
//   NAJFM study found solunar tables don't predict activity), so the weight
//   leans on the well-supported dawn/dusk-alignment bonus, not raw phase.
// - Wind direction relative to shore matters more than speed per multiple
//   independent sources — not yet possible to score (no coastline aspect
//   until Phase 4), flagged honestly in the factor's note rather than
//   pretending the curve is complete.
export const DEFAULT_WEIGHT_PROFILES: Record<Mode, WeightProfile> = {
  shore: {
    mode: "shore",
    weights: {
      pressure: 20,
      wind: 16,
      waves: 14,
      turbidity: 8,
      seaTemp: 8,
      light: 18,
      precipitation: 6,
      solunar: 10,
      current: 6,
      seasonality: 6,
    },
  },
  boat: {
    mode: "boat",
    weights: {
      pressure: 18,
      wind: 20,
      waves: 16,
      turbidity: 4,
      seaTemp: 8,
      light: 14,
      precipitation: 6,
      solunar: 8,
      current: 8,
      seasonality: 6,
    },
  },
  spearfishing: {
    mode: "spearfishing",
    weights: {
      pressure: 2,
      wind: 14,
      waves: 20,
      turbidity: 25,
      seaTemp: 6,
      light: 10,
      precipitation: 4,
      solunar: 3,
      current: 8,
      seasonality: 5,
    },
  },
};
