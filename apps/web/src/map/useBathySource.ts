import { useQuery } from "@tanstack/react-query";

export type BathyQuality = "survey" | "satellite" | "global" | "unknown";

export interface BathySource {
  quality: BathyQuality;
  organisation: string | null;
  identifier: string | null;
  release: string | null;
}

/**
 * Provenance of the depth data under a given point.
 *
 * The contour layer looks authoritative everywhere, but EMODnet's Greek
 * coverage is a patchwork — real survey in places, satellite-derived
 * estimates in others, and GEBCO's ~450 m global grid over much of it.
 * Rendering all three identically invites trust the data hasn't earned, so
 * the spot panel names which one you're actually looking at.
 *
 * Effectively static per location, hence the very long stale time; the API
 * caches it for a week on its side too.
 */
export function useBathySource(lat: number, lon: number) {
  return useQuery({
    queryKey: ["bathy-source", Math.round(lat * 100) / 100, Math.round(lon * 100) / 100],
    queryFn: async ({ signal }): Promise<BathySource> => {
      const res = await fetch(`/api/bathy/source?lat=${lat}&lon=${lon}`, { signal });
      if (!res.ok) throw new Error(`bathy source ${res.status}`);
      return res.json() as Promise<BathySource>;
    },
    staleTime: 24 * 60 * 60_000,
    retry: false,
  });
}
