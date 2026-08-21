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
//
// Rebalanced 2026-08-22, on top of the same day's curve recalibration
// (see factors.ts / PROGRESS.md): even with harsher curves, live-tested
// conditions still leaned generous because the two most evidence-backed
// factors — pressure (top predictor per the tagging studies above) and
// light/time-of-day (DEV_PLAN.md §4.6 calls this "the strongest single
// predictor," full stop) — weren't actually weighted like it. A real case
// caught this directly: a midnight spearfishing check scored 69 ("Good")
// because clear, calm water outweighted the fact that it was pitch dark —
// light was only ~11% of spearfishing's total weight. Pushed pressure and
// light up everywhere; pulled down solunar (explicitly contested science,
// see above — it shouldn't be competing with pressure for influence) and
// current (a real but secondary signal) to make room. Seasonality also
// moved up — it's a legitimate grounding signal that was underweighted
// relative to how much it now discriminates after the curve recalibration.
export const DEFAULT_WEIGHT_PROFILES: Record<Mode, WeightProfile> = {
  shore: {
    mode: "shore",
    weights: {
      pressure: 24,
      wind: 15,
      waves: 13,
      turbidity: 7,
      seaTemp: 10,
      light: 20,
      precipitation: 5,
      solunar: 6,
      current: 5,
      seasonality: 9,
    },
  },
  boat: {
    mode: "boat",
    weights: {
      pressure: 22,
      wind: 18,
      waves: 14,
      turbidity: 3,
      seaTemp: 10,
      light: 16,
      precipitation: 5,
      solunar: 5,
      current: 6,
      seasonality: 9,
    },
  },
  spearfishing: {
    mode: "spearfishing",
    weights: {
      pressure: 2,
      wind: 12,
      waves: 15,
      turbidity: 19,
      seaTemp: 6,
      light: 20,
      precipitation: 4,
      solunar: 3,
      current: 7,
      seasonality: 5,
    },
  },
};
