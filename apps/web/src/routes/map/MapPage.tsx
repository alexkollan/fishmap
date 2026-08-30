import { useCallback, useState } from "react";
import type { Map as MaplibreMap } from "maplibre-gl";
import type { ActiveLocation } from "@fishmap/types";
import { useActiveLocation } from "@/location/useActiveLocation";
import { useModeStore } from "@/lib/mode/store";
import { useI18n } from "@/lib/i18n";
import { ModeSwitch } from "@/ui/ModeSwitch";
import { MapCanvas } from "@/map/MapCanvas";
import { SpotSheet } from "@/map/SpotSheet";
import { LayerDrawer } from "@/map/LayerDrawer";
import { useMapLayers } from "@/map/useMapLayers";
import { useWindyLayer } from "@/map/useWindyLayer";

// MapLibre lands here as a lazy chunk (App.tsx) — no other route imports
// anything in src/map/, so this stays the only place that pays for it
// (DEV_PLAN.md §5.6).
//
// Deliberately minimal (2026-08-25 — see PROGRESS.md): no score/factor
// overlay, no time scrubber. Just the base map, a pin at the active
// location, and tap-to-inspect via SpotSheet — the score-layer pipeline this
// used to have was cut entirely after repeatedly running into Open-Meteo
// free-tier rate limits with no fix that stayed simple. The
// bathymetry/posidonia/seamarks overlay toggles are unrelated (not
// Open-Meteo-backed) and stay. useWindyLayer (added later) is a separate,
// much coarser (0.5° vs the old 0.1°) backend-precomputed grid for a purely
// decorative wind/current/pressure layer, unrelated to scoring — see its own
// file comment for why its rate-limit math doesn't repeat the old problem.
export function MapPage() {
  const { location, setLocation } = useActiveLocation();
  const mode = useModeStore((s) => s.mode);
  const { t } = useI18n();

  const [map, setMap] = useState<MaplibreMap | null>(null);
  const [sheet, setSheet] = useState<ActiveLocation | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const layers = useMapLayers(map);
  const windy = useWindyLayer(map);

  const handleReady = useCallback((m: MaplibreMap) => setMap(m), []);

  const handleTap = useCallback(
    (lngLat: { lng: number; lat: number }) => {
      const next: ActiveLocation = { lat: lngLat.lat, lon: lngLat.lng, name: `${lngLat.lat.toFixed(3)}, ${lngLat.lng.toFixed(3)}` };
      setLocation(next);
      setSheet(next);
    },
    [setLocation],
  );

  return (
    <div className="relative flex h-[calc(100vh-8.5rem)] flex-col md:h-[calc(100vh-3.75rem)]">
      <div className="relative flex-1">
        <MapCanvas center={location} onReady={handleReady} onTap={handleTap} />

        <div className="absolute left-3 top-3 z-10 flex flex-col gap-2">
          <ModeSwitch />
        </div>

        <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            className="rounded-md border border-white/10 bg-ground-raised px-3 py-2 text-sm text-ink shadow hover:bg-white/5"
          >
            {t.map.layers}
          </button>
        </div>

        {drawerOpen && (
          <LayerDrawer overlays={layers.overlays} onToggleOverlay={layers.toggleOverlay} onClose={() => setDrawerOpen(false)} windy={windy} />
        )}

        {sheet && <SpotSheet location={sheet} mode={mode} onClose={() => setSheet(null)} />}

        <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-md bg-ground/80 px-3 py-1 text-xs text-ink-muted">
          {t.common.notForNavigation}
        </div>
      </div>
    </div>
  );
}

export default MapPage;
