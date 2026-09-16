import { Link } from "react-router-dom";
import type { ActiveLocation, ScoreResult, SunMoonData } from "@fishmap/types";
import { useI18n } from "@/lib/i18n";
import { renderVetoNote } from "@/lib/i18n/renderFactorNote";
import { formatLocalTime } from "@/lib/formatTime";
import { FactorBreakdown } from "@/ui/FactorBreakdown";
import { useBathySource } from "./useBathySource";

interface SpotDetailsProps {
  location: ActiveLocation;
  result: ScoreResult;
  sunMoon: SunMoonData;
}

const CONDITION_LINKS: { to: string; labelKey: "wind" | "sea" | "pressure" | "sky" | "sunMoon" }[] = [
  { to: "/conditions/wind", labelKey: "wind" },
  { to: "/conditions/sea", labelKey: "sea" },
  { to: "/conditions/pressure", labelKey: "pressure" },
  { to: "/conditions/sky", labelKey: "sky" },
  { to: "/conditions/sun-moon", labelKey: "sunMoon" },
];

// The "why" behind the pin's score (DEV_PLAN.md §6.5) — a summary, not a
// replacement for the detail pages, so every row links through to the
// relevant /conditions/* page for this exact location.
//
// Was a self-contained bottom sheet until 2026-09-16; it's now the expanded
// body of MapScorePanel, which owns the sheet chrome and the time scrubber.
// Purely presentational: it renders the ScoreResult for whichever hour the
// scrubber has selected, so it follows the scrubber rather than being pinned
// to "now".
export function SpotDetails({ location, result, sunMoon }: SpotDetailsProps) {
  const { t, locale } = useI18n();
  const { data: bathy } = useBathySource(location.lat, location.lon);
  const search = `?lat=${location.lat}&lon=${location.lon}&name=${encodeURIComponent(location.name)}`;

  return (
    <div className="flex flex-col gap-4 pt-1">
      {result.vetoes.length > 0 && (
        <div className="rounded-md border border-score-bad/30 bg-score-bad/10 px-3 py-2 text-sm text-score-bad">
          {result.vetoes.map((v) => (
            <p key={v.key}>{renderVetoNote(t, v)}</p>
          ))}
        </div>
      )}

      <FactorBreakdown factors={result.factors} limit={4} expandable />

      <div className="flex items-center justify-between text-sm text-ink-muted">
        <span>
          {t.sunMoon.sunrise} {formatLocalTime(sunMoon.sun.sunrise, locale)}
        </span>
        <span>
          {t.sunMoon.sunset} {formatLocalTime(sunMoon.sun.sunset, locale)}
        </span>
      </div>

      {bathy && bathy.quality !== "unknown" && (
        <p className="text-xs leading-snug text-ink-muted/80">
          {t.map.depthSource[bathy.quality].replace("{source}", bathy.organisation ?? bathy.identifier ?? "")}
        </p>
      )}

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
  );
}
