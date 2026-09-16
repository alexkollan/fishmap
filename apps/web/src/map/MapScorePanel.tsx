import { useMemo, useState } from "react";
import type { ActiveLocation, Mode } from "@fishmap/types";
import { getSunMoonData } from "@fishmap/scoring";
import { useI18n } from "@/lib/i18n";
import { useConditions } from "@/lib/weather/useConditions";
import { formatLocalDay, formatLocalTime } from "@/lib/formatTime";
import { scoreBandKey, scoreColor } from "@/lib/score";
import { SpotDetails } from "./SpotDetails";
import { TimeScrubber } from "./TimeScrubber";

interface MapScorePanelProps {
  location: ActiveLocation;
  mode: Mode;
  /** ISO hour the scrubber is parked on, or null for "now". Owned by the
   * page so that moving the pin keeps the selected time — tapping around the
   * coast to compare Saturday afternoon between spots is the whole point. */
  selectedTime: string | null;
  onSelectTime: (iso: string | null) => void;
  approximate: boolean;
}

/**
 * The map's permanent bottom panel: the score for the pinned spot, plus a
 * scrubber for moving that score through the forecast.
 *
 * Note what this is *not*: map-wide scoring. It's the same single-point
 * `useConditions()` lookup every other page makes (one cached Open-Meteo
 * request for the pin's 0.25° grid cell), just read at a different hour —
 * which is why it sidesteps the rate-limit wall that killed the old
 * whole-coastline score layers twice. See CLAUDE.md's map section.
 */
export function MapScorePanel({ location, mode, selectedTime, onSelectTime, approximate }: MapScorePanelProps) {
  const { t, locale } = useI18n();
  const { bundle, isLoading, isError } = useConditions(location, mode);
  const [expanded, setExpanded] = useState(false);

  const selectedIndex = useMemo(() => {
    if (!bundle) return 0;
    if (!selectedTime) return bundle.nowIndex;
    const target = Date.parse(selectedTime);
    if (Number.isNaN(target)) return bundle.nowIndex;
    let best = bundle.nowIndex;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (let i = bundle.nowIndex; i < bundle.hours.length; i++) {
      const diff = Math.abs(Date.parse(bundle.hours[i]!.hour.time) - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = i;
      }
    }
    return best;
  }, [bundle, selectedTime]);

  const selected = bundle?.hours[selectedIndex] ?? null;
  const isNow = bundle !== null && selectedIndex === bundle.nowIndex;

  // Sun/moon follows the scrubber rather than today, so an expanded panel
  // parked on Friday shows Friday's sunrise.
  const sunMoon = useMemo(() => {
    if (!bundle || !selected) return null;
    return getSunMoonData(new Date(selected.hour.time), bundle.series.latitude, bundle.series.longitude);
  }, [bundle, selected]);

  return (
    <div className="z-20 shrink-0 border-t border-white/10 bg-ground-raised px-4 pb-3 pt-2.5 shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">
              {location.name || `${location.lat.toFixed(3)}, ${location.lon.toFixed(3)}`}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span>
                {isNow
                  ? t.map.now
                  : selected
                    ? `${formatLocalDay(selected.hour.time, locale)} ${formatLocalTime(selected.hour.time, locale)}`
                    : "—"}
              </span>
              {approximate && (
                <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] leading-none">
                  {t.map.approximateLocation}
                </span>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {!isNow && (
              <button
                type="button"
                onClick={() => onSelectTime(null)}
                className="rounded-md border border-white/10 px-2 py-1 text-xs text-ink-muted hover:text-ink"
              >
                {t.map.backToNow}
              </button>
            )}
            {selected && (
              <div className="flex items-baseline gap-2">
                <span className="font-tabular text-3xl font-semibold leading-none" style={{ color: scoreColor(selected.result.score) }}>
                  {selected.result.score}
                </span>
                <span className="text-sm text-ink-muted">{t.score.bands[scoreBandKey(selected.result.score)]}</span>
              </div>
            )}
          </div>
        </div>

        {isLoading && <p className="py-3 text-sm text-ink-muted">{t.common.loading}</p>}
        {isError && <p className="py-3 text-sm text-score-bad">{t.common.error}</p>}

        {bundle && (
          <>
            <TimeScrubber
              hours={bundle.hours}
              startIndex={bundle.nowIndex}
              value={selectedIndex}
              onChange={(index) => onSelectTime(bundle.hours[index]!.hour.time)}
            />

            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="self-start text-sm text-ink-muted underline decoration-white/20 hover:text-ink"
            >
              {expanded ? t.map.hideDetails : t.map.showDetails}
            </button>

            {expanded && selected && sunMoon && (
              <div className="max-h-[38vh] overflow-y-auto">
                <SpotDetails location={location} result={selected.result} sunMoon={sunMoon} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
