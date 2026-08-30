import { useI18n } from "@/lib/i18n";
import type { OverlayState } from "./useMapLayers";
import type { ParticleMode } from "./useWindyLayer";

interface LayerDrawerProps {
  overlays: OverlayState;
  onToggleOverlay: (key: keyof OverlayState) => void;
  onClose: () => void;
  windy?: {
    enabled: boolean;
    particleMode: ParticleMode;
    setParticleMode: (mode: ParticleMode) => void;
    pressureOn: boolean;
    togglePressure: () => void;
  };
}

const OVERLAY_KEYS: (keyof OverlayState)[] = ["bathymetry", "posidonia", "seamarks"];
const PARTICLE_MODES: ParticleMode[] = ["off", "wind", "current"];

// Map overlay control (DEV_PLAN.md §6.4): independent raster layers drawn on
// top of the base map. The score/factor overlay this drawer used to also
// control was removed 2026-08-25 — see PROGRESS.md — the map now only does
// tap-to-inspect via SpotSheet. State persists to localStorage via useMapLayers.
export function LayerDrawer({ overlays, onToggleOverlay, onClose, windy }: LayerDrawerProps) {
  const { t } = useI18n();

  return (
    <div className="absolute right-3 top-14 z-20 w-64 rounded-lg border border-white/10 bg-ground-raised p-3 shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-ink">{t.map.layers}</p>
        <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink" aria-label={t.map.closeSheet}>
          ✕
        </button>
      </div>

      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-muted">{t.map.overlays}</p>
      <div className="flex flex-col gap-1">
        {OVERLAY_KEYS.map((key) => (
          <label key={key} className="flex items-center gap-2 px-2 py-1 text-sm text-ink">
            <input type="checkbox" checked={overlays[key]} onChange={() => onToggleOverlay(key)} className="accent-score-good" />
            {t.map.overlayLabels[key]}
          </label>
        ))}
      </div>

      {windy?.enabled && (
        <>
          <p className="mb-1 mt-3 text-xs font-medium uppercase tracking-wide text-ink-muted">{t.map.windy.title}</p>
          <div className="flex flex-col gap-1">
            {PARTICLE_MODES.map((mode) => (
              <label key={mode} className="flex items-center gap-2 px-2 py-1 text-sm text-ink">
                <input
                  type="radio"
                  name="windy-particle-mode"
                  checked={windy.particleMode === mode}
                  onChange={() => windy.setParticleMode(mode)}
                  className="accent-score-good"
                />
                {t.map.windy.particleModes[mode]}
              </label>
            ))}
            <label className="flex items-center gap-2 px-2 py-1 text-sm text-ink">
              <input type="checkbox" checked={windy.pressureOn} onChange={() => windy.togglePressure()} className="accent-score-good" />
              {t.map.windy.pressure}
            </label>
          </div>
        </>
      )}
    </div>
  );
}
