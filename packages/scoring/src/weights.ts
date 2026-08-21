import type { Mode, WeightProfile } from "@fishmap/types";

// v1 hypothesis, not truth (DEV_PLAN.md §12) — the Phase 7 live weight
// editor is what tunes these against real outings. Values reflect each
// mode's stated priorities in §4: pressure and light dominate shore/boat;
// waves and turbidity (visibility) dominate spearfishing; pressure barely
// matters there since a spearo doesn't care about fish appetite.
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
      turbidity: 20,
      seaTemp: 8,
      light: 10,
      precipitation: 4,
      solunar: 4,
      current: 6,
      seasonality: 6,
    },
  },
};
