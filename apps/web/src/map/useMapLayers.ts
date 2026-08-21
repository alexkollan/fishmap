import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Map as MaplibreMap } from "maplibre-gl";

export type ScoreLayerKey = "overall" | "wind" | "waves" | "pressure" | "seaTemp" | "turbidity" | "current" | "light";

export interface OverlayState {
  bathymetry: boolean;
  posidonia: boolean;
  seamarks: boolean;
}

interface OverlayStore {
  overlays: OverlayState;
  toggleOverlay: (key: keyof OverlayState) => void;
}

// Layer state persists across sessions (DEV_PLAN.md §6.4: "the app opens
// the way it was left").
const useOverlayStore = create<OverlayStore>()(
  persist(
    (set) => ({
      overlays: { bathymetry: false, posidonia: false, seamarks: false },
      toggleOverlay: (key) => set((s) => ({ overlays: { ...s.overlays, [key]: !s.overlays[key] } })),
    }),
    { name: "fishmap:map-overlays" },
  ),
);

const OVERLAY_DEFS: Record<keyof OverlayState, { sourceId: string; layerId: string; tiles: string[]; opacity: number }> = {
  bathymetry: {
    sourceId: "overlay-bathymetry",
    layerId: "overlay-bathymetry-layer",
    tiles: [`${window.location.origin}/api/tiles/bathymetry/{z}/{x}/{y}.png`],
    opacity: 0.55,
  },
  posidonia: {
    sourceId: "overlay-posidonia",
    layerId: "overlay-posidonia-layer",
    tiles: [`${window.location.origin}/api/tiles/habitat/{z}/{x}/{y}.png`],
    opacity: 0.6,
  },
  // Direct per DEV_PLAN.md §3.4 — only EMODnet is rate-limited enough to need
  // the disk-cached proxy; OpenSeaMap is a plain free XYZ raster tile set.
  seamarks: {
    sourceId: "overlay-seamarks",
    layerId: "overlay-seamarks-layer",
    tiles: ["https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"],
    opacity: 1,
  },
};

/** Adds/removes raster overlay sources+layers on the map as their toggles
 * flip, above the coastline line layer so overlays never hide the score. */
export function useMapLayers(map: MaplibreMap | null) {
  const overlays = useOverlayStore((s) => s.overlays);
  const toggleOverlay = useOverlayStore((s) => s.toggleOverlay);

  useEffect(() => {
    if (!map) return;

    for (const key of Object.keys(OVERLAY_DEFS) as (keyof OverlayState)[]) {
      const def = OVERLAY_DEFS[key];
      const wanted = overlays[key];
      const has = map.getLayer(def.layerId);

      if (wanted && !has) {
        if (!map.getSource(def.sourceId)) {
          map.addSource(def.sourceId, { type: "raster", tiles: def.tiles, tileSize: 256 });
        }
        map.addLayer({ id: def.layerId, type: "raster", source: def.sourceId, paint: { "raster-opacity": def.opacity } });
      } else if (!wanted && has) {
        map.removeLayer(def.layerId);
        if (map.getSource(def.sourceId)) map.removeSource(def.sourceId);
      }
    }
  }, [map, overlays]);

  return { overlays, toggleOverlay };
}
