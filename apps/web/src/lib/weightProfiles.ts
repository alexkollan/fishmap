import { useQuery } from "@tanstack/react-query";
import { DEFAULT_WEIGHT_PROFILES } from "@fishmap/scoring";
import type { Mode, WeightProfile } from "@fishmap/types";

async function fetchWeights(): Promise<Record<Mode, Record<string, number>>> {
  const res = await fetch("/api/weights");
  if (!res.ok) throw new Error(`Failed to load weights: ${res.status}`);
  return res.json() as Promise<Record<Mode, Record<string, number>>>;
}

/**
 * Resolved weight profiles (admin overrides merged with defaults,
 * DEV_PLAN.md §8) — every page scores against this instead of the static
 * `DEFAULT_WEIGHT_PROFILES` so the live weight editor actually changes
 * what users see, not just an admin preview. Falls back to the hardcoded
 * defaults on fetch failure so scoring never breaks over a flaky request.
 */
export function useWeightProfiles(): Record<Mode, WeightProfile> {
  const { data } = useQuery({
    queryKey: ["weights"],
    queryFn: fetchWeights,
    staleTime: 5 * 60_000,
  });

  if (!data) return DEFAULT_WEIGHT_PROFILES;

  return {
    shore: { mode: "shore", weights: data.shore ?? DEFAULT_WEIGHT_PROFILES.shore.weights },
    boat: { mode: "boat", weights: data.boat ?? DEFAULT_WEIGHT_PROFILES.boat.weights },
    spearfishing: { mode: "spearfishing", weights: data.spearfishing ?? DEFAULT_WEIGHT_PROFILES.spearfishing.weights },
  };
}
