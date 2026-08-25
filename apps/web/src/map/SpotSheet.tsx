import { Link } from "react-router-dom";
import type { ActiveLocation, Mode } from "@fishmap/types";
import { useI18n } from "@/lib/i18n";
import { renderVetoNote } from "@/lib/i18n/renderFactorNote";
import { useConditions } from "@/lib/weather/useConditions";
import { formatLocalTime } from "@/lib/formatTime";
import { ScoreBadge } from "@/ui/ScoreBadge";
import { FactorBreakdown } from "@/ui/FactorBreakdown";

interface SpotSheetProps {
  location: ActiveLocation;
  mode: Mode;
  onClose: () => void;
}

const CONDITION_LINKS: { to: string; labelKey: "wind" | "sea" | "pressure" | "sky" | "sunMoon" }[] = [
  { to: "/conditions/wind", labelKey: "wind" },
  { to: "/conditions/sea", labelKey: "sea" },
  { to: "/conditions/pressure", labelKey: "pressure" },
  { to: "/conditions/sky", labelKey: "sky" },
  { to: "/conditions/sun-moon", labelKey: "sunMoon" },
];

// Bottom sheet on tap (DEV_PLAN.md §6.5) — a summary, not a replacement for
// the detail pages. Every row links through to the relevant /conditions/*
// page for this exact location, which is the bridge between map and app.
export function SpotSheet({ location, mode, onClose }: SpotSheetProps) {
  const { t, locale } = useI18n();
  const { bundle, isLoading, isError } = useConditions(location, mode);
  const search = `?lat=${location.lat}&lon=${location.lon}&name=${encodeURIComponent(location.name)}`;

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-ground-raised p-4 shadow-2xl">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-ink">{location.name || `${location.lat.toFixed(3)}, ${location.lon.toFixed(3)}`}</p>
          <p className="text-xs text-ink-muted">
            {location.lat.toFixed(3)}, {location.lon.toFixed(3)}
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-ink-muted hover:bg-white/5 hover:text-ink" aria-label={t.map.closeSheet}>
          ✕
        </button>
      </div>

      {isLoading && <p className="text-sm text-ink-muted">{t.common.loading}</p>}
      {isError && <p className="text-sm text-score-bad">{t.common.error}</p>}

      {bundle && (
        <div className="flex flex-col gap-4">
          {bundle.now.result.vetoes.length > 0 && (
            <div className="rounded-md border border-score-bad/30 bg-score-bad/10 px-3 py-2 text-sm text-score-bad">
              {bundle.now.result.vetoes.map((v) => (
                <p key={v.key}>{renderVetoNote(t, v)}</p>
              ))}
            </div>
          )}

          <ScoreBadge score={bundle.now.result.score} size="md" />

          <FactorBreakdown factors={bundle.now.result.factors} limit={4} expandable />

          <div className="flex items-center justify-between text-sm text-ink-muted">
            <span>{t.sunMoon.sunrise} {formatLocalTime(bundle.sunMoonToday.sun.sunrise, locale)}</span>
            <span>{t.sunMoon.sunset} {formatLocalTime(bundle.sunMoonToday.sun.sunset, locale)}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {CONDITION_LINKS.map((link) => (
              <Link
                key={link.to}
                to={`${link.to}${search}`}
                className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-ink hover:bg-white/5"
              >
                {t.nav.conditions[link.labelKey]}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
