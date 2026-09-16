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
import { useBathymetryLayer } from "@/map/useBathymetryLayer";

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
  useBathymetryLayer(map, layers.overlays.bathymetry);

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

        <div className="absolute left-3 top-3 z-10">
          <ModeSwitch />
        </div>

        {/* Right stack sits below MapLibre's own zoom control (top-right,
            ~3.5rem tall) and clear of the mode switch, which runs nearly the
            full width at phone sizes. Icon-only for the same reason — the
            text labels used to collide with both. */}
        <div className="absolute right-3 top-16 z-10 flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            title={t.map.layers}
            aria-label={t.map.layers}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-ground-raised/90 text-ink shadow-lg backdrop-blur hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M12 3 3 8l9 5 9-5-9-5Z" strokeLinejoin="round" />
              <path d="m3 13 9 5 9-5" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => void locate()}
            disabled={locating}
            title={t.location.useMyLocation}
            aria-label={t.location.useMyLocation}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-ground-raised/90 text-ink shadow-lg backdrop-blur hover:bg-white/10 disabled:opacity-60"
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-5 w-5 ${locating ? "animate-pulse" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3.5" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
            </svg>
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
