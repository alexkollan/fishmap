import { useI18n } from "@/lib/i18n";
import type { OverlayState, ScoreLayerKey } from "./useMapLayers";

interface LayerDrawerProps {
  scoreLayer: ScoreLayerKey;
  onScoreLayerChange: (key: ScoreLayerKey) => void;
  overlays: OverlayState;
  onToggleOverlay: (key: keyof OverlayState) => void;
  onClose: () => void;
}

const SCORE_LAYERS: ScoreLayerKey[] = ["overall", "wind", "waves", "pressure", "seaTemp", "turbidity", "current", "light"];
const OVERLAY_KEYS: (keyof OverlayState)[] = ["bathymetry", "posidonia", "seamarks"];

// Per-parameter layer control (DEV_PLAN.md §6.4): score layers paint a
// full-viewport factor heatmap (useAreaScoreGrid.ts) — the coastline itself
// always stays on Overall. Overlays draw independent raster layers on top
// of everything. State persists to localStorage via useMapLayers.
export function LayerDrawer({ scoreLayer, onScoreLayerChange, overlays, onToggleOverlay, onClose }: LayerDrawerProps) {
  const { t } = useI18n();

  return (
    <div className="absolute right-3 top-14 z-20 w-64 rounded-lg border border-white/10 bg-ground-raised p-3 shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-ink">{t.map.layers}</p>
        <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink" aria-label={t.map.closeSheet}>
          ✕
        </button>
      </div>

      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-muted">{t.map.scoreLayers}</p>
      <div className="mb-3 flex flex-col gap-0.5">
        {SCORE_LAYERS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onScoreLayerChange(key)}
            className={`rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
              key === scoreLayer ? "bg-white/10 text-ink" : "text-ink-muted hover:text-ink"
            }`}
            aria-pressed={key === scoreLayer}
          >
            {key === "overall" ? t.map.overallLayer : t.factors[key]}
          </button>
        ))}
      </div>

      {scoreLayer !== "overall" && (
        <div className="mb-3 px-2">
          <div className="h-2 w-full rounded-full" style={{ background: "linear-gradient(to right, #f87171, #facc15, #4ade80)" }} />
          <div className="mt-1 flex justify-between text-[10px] text-ink-muted">
            <span>0</span>
            <span>100</span>
          </div>
        </div>
      )}

      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-muted">{t.map.overlays}</p>
      <div className="flex flex-col gap-1">
        {OVERLAY_KEYS.map((key) => (
          <label key={key} className="flex items-center gap-2 px-2 py-1 text-sm text-ink">
            <input type="checkbox" checked={overlays[key]} onChange={() => onToggleOverlay(key)} className="accent-score-good" />
            {t.map.overlayLabels[key]}
          </label>
        ))}
      </div>
    </div>
  );
}
