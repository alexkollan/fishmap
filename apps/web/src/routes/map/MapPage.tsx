import { useCallback, useEffect, useMemo, useState } from "react";
import type { Map as MaplibreMap } from "maplibre-gl";
import type { ActiveLocation } from "@fishmap/types";
import { useActiveLocation } from "@/location/useActiveLocation";
import { useModeStore } from "@/lib/mode/store";
import { useI18n } from "@/lib/i18n";
import { ModeSwitch } from "@/ui/ModeSwitch";
import { MapCanvas } from "@/map/MapCanvas";
import { TimeScrubber } from "@/map/TimeScrubber";
import { SpotSheet } from "@/map/SpotSheet";
import { LayerDrawer } from "@/map/LayerDrawer";
import { useCoastlineScoring } from "@/map/useCoastlineScoring";
import { useMapLayers, type ScoreLayerKey } from "@/map/useMapLayers";

function findNowIndex(times: string[]): number {
  const nowMs = Date.now();
  let index = 0;
  for (let i = 0; i < times.length; i++) {
    if (new Date(times[i]!).getTime() <= nowMs) index = i;
    else break;
  }
  return index;
}

// MapLibre lands here as a lazy chunk (App.tsx) — no other route imports
// anything in src/map/, so this stays the only place that pays for it
// (DEV_PLAN.md §5.6).
export function MapPage() {
  const { location, setLocation } = useActiveLocation();
  const mode = useModeStore((s) => s.mode);
  const { t } = useI18n();

  const [map, setMap] = useState<MaplibreMap | null>(null);
  const [hourIndex, setHourIndex] = useState<number | null>(null);
  const [sheet, setSheet] = useState<{ location: ActiveLocation; aspectDeg: number | null } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scoreLayer, setScoreLayer] = useState<ScoreLayerKey>("overall");

  const scoring = useCoastlineScoring(map, mode, hourIndex ?? 0, scoreLayer);
  const nowIndex = useMemo(() => findNowIndex(scoring.hourlyTimes), [scoring.hourlyTimes]);

  // Snap to "now" the first moment we know where that is; after that the
  // user's own scrubbing is left alone.
  useEffect(() => {
    if (hourIndex === null && scoring.hourlyTimes.length > 0) setHourIndex(nowIndex);
  }, [hourIndex, nowIndex, scoring.hourlyTimes.length]);

  const layers = useMapLayers(map);

  const handleReady = useCallback((m: MaplibreMap) => setMap(m), []);

  const handleSegmentTap = useCallback(
    (props: Record<string, unknown> | null, lngLat: { lng: number; lat: number }) => {
      if (props && typeof props.lat === "number" && typeof props.lon === "number") {
        const next: ActiveLocation = { lat: props.lat, lon: props.lon, name: t.map.coastlinePoint };
        setLocation(next);
        setSheet({ location: next, aspectDeg: typeof props.aspectDeg === "number" ? props.aspectDeg : null });
      } else {
        const next: ActiveLocation = { lat: lngLat.lat, lon: lngLat.lng, name: `${lngLat.lat.toFixed(3)}, ${lngLat.lng.toFixed(3)}` };
        setLocation(next);
        setSheet({ location: next, aspectDeg: null });
      }
    },
    [setLocation, t.map.coastlinePoint],
  );

  return (
    <div className="relative flex h-[calc(100vh-8.5rem)] flex-col md:h-[calc(100vh-3.75rem)]">
      <div className="relative flex-1">
        <MapCanvas center={location} onReady={handleReady} onSegmentTap={handleSegmentTap} />

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
          {scoring.fetchingGrid && (
            <span className="rounded-md bg-ground-raised px-2 py-1 text-xs text-ink-muted shadow">{t.common.loading}</span>
          )}
        </div>

        {drawerOpen && (
          <LayerDrawer
            scoreLayer={scoreLayer}
            onScoreLayerChange={setScoreLayer}
            overlays={layers.overlays}
            onToggleOverlay={layers.toggleOverlay}
            onClose={() => setDrawerOpen(false)}
          />
        )}

        {sheet && <SpotSheet location={sheet.location} aspectDeg={sheet.aspectDeg} mode={mode} onClose={() => setSheet(null)} />}

        <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-md bg-ground/80 px-3 py-1 text-xs text-ink-muted">
          {t.common.notForNavigation}
        </div>
      </div>

      <TimeScrubber
        hourlyTimes={scoring.hourlyTimes}
        hourIndex={hourIndex ?? nowIndex}
        nowIndex={nowIndex}
        sparkline={scoring.sparkline}
        onChange={setHourIndex}
      />
    </div>
  );
}

export default MapPage;
