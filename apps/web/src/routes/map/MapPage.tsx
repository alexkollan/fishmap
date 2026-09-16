import { useCallback, useState } from "react";
import type { Map as MaplibreMap } from "maplibre-gl";
import type { ActiveLocation } from "@fishmap/types";
import { useActiveLocation } from "@/location/useActiveLocation";
import { useVisitorLocation } from "@/location/useVisitorLocation";
import { useModeStore } from "@/lib/mode/store";
import { useI18n } from "@/lib/i18n";
import { ModeSwitch } from "@/ui/ModeSwitch";
import { MapCanvas } from "@/map/MapCanvas";
import { MapScorePanel } from "@/map/MapScorePanel";
import { LayerDrawer } from "@/map/LayerDrawer";
import { useMapLayers } from "@/map/useMapLayers";
import { useWindyLayer } from "@/map/useWindyLayer";

// MapLibre lands here as a lazy chunk (App.tsx) — no other route imports
// anything in src/map/, so this stays the only place that pays for it
// (DEV_PLAN.md §5.6). Still lazy even though this is now the landing route:
// the chunk boundary is what keeps MapLibre off /today, /forecast and the
// rest, which matters more than shaving a Suspense flash off the homepage.
//
// Still no map-wide scoring (2026-08-25 — see PROGRESS.md): no factor
// overlay, no per-cell heatmap. The bottom panel's score and time scrubber
// are a *single-point* lookup for the pin, the same one every other page
// makes, so they don't reopen the Open-Meteo rate-limit problem that got the
// old whole-coastline score layers cut twice. The bathymetry/posidonia/
// seamarks overlays are unrelated (not Open-Meteo-backed) and stay, as does
// useWindyLayer's coarse decorative wind/current/pressure grid.
export function MapPage() {
  const { location, setLocation } = useActiveLocation();
  const mode = useModeStore((s) => s.mode);
  const { t } = useI18n();

  const [map, setMap] = useState<MaplibreMap | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const layers = useMapLayers(map);
  const windy = useWindyLayer(map);

  const handleReady = useCallback((m: MaplibreMap) => setMap(m), []);

  // Deliberately not memoized: `setLocation` closes over the current search
  // params, so pinning this to a stale identity would write the location
  // against a stale URL. useVisitorLocation keeps it in a ref, so a fresh
  // function every render costs nothing and never re-fires the landing effect.
  const handleLocated = (next: ActiveLocation) => setLocation(next, "auto");
  const { locating, approximate, locate } = useVisitorLocation(handleLocated);

  const handleTap = useCallback(
    (lngLat: { lng: number; lat: number }) => {
      setLocation({
        lat: lngLat.lat,
        lon: lngLat.lng,
        name: `${lngLat.lat.toFixed(3)}, ${lngLat.lng.toFixed(3)}`,
      });
    },
    [setLocation],
  );

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col md:h-[calc(100vh-3.75rem)]">
      <div className="relative flex-1">
        <MapCanvas center={location} onReady={handleReady} onTap={handleTap} />

        <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-2">
          <ModeSwitch />
          <button
            type="button"
            onClick={() => void locate()}
            disabled={locating}
            className="rounded-md border border-white/10 bg-ground-raised px-3 py-2 text-sm text-ink shadow hover:bg-white/5 disabled:opacity-60"
          >
            {locating ? t.location.locating : t.location.useMyLocation}
          </button>
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

        <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-md bg-ground/80 px-3 py-1 text-xs text-ink-muted">
          {t.common.notForNavigation}
        </div>
      </div>

      <MapScorePanel
        location={location}
        mode={mode}
        selectedTime={selectedTime}
        onSelectTime={setSelectedTime}
        approximate={approximate}
      />
    </div>
  );
}

export default MapPage;
