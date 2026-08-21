import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { formatLocalDay, formatLocalTime } from "@/lib/formatTime";
import { scoreColor } from "@/lib/score";

interface TimeScrubberProps {
  hourlyTimes: string[];
  hourIndex: number;
  nowIndex: number;
  sparkline: (number | null)[];
  onChange: (index: number) => void;
}

// Time scrubber + score sparkline (DEV_PLAN.md §6.3): scrubbing this is zero
// network requests — the whole 9-day series for every fetched grid cell is
// already in the worker's memory (DEV_PLAN.md §5.2).
export function TimeScrubber({ hourlyTimes, hourIndex, nowIndex, sparkline, onChange }: TimeScrubberProps) {
  const { t, locale } = useI18n();
  const max = Math.max(0, hourlyTimes.length - 1);
  const current = hourlyTimes[hourIndex];

  const sparkPath = useMemo(() => {
    if (sparkline.length < 2) return null;
    const w = 100;
    const h = 24;
    const points: string[] = [];
    let started = false;
    for (let i = 0; i < sparkline.length; i++) {
      const v = sparkline[i];
      const x = (i / (sparkline.length - 1)) * w;
      if (v === null || v === undefined) continue;
      const y = h - (v / 100) * h;
      points.push(`${started ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`);
      started = true;
    }
    return points.length > 1 ? points.join(" ") : null;
  }, [sparkline]);

  return (
    <div className="flex flex-col gap-1 border-t border-white/10 bg-ground px-3 py-2">
      <div className="flex items-baseline justify-between text-xs text-ink-muted">
        <span>
          {current ? `${formatLocalDay(current, locale)} · ${formatLocalTime(current, locale)}` : "—"}
        </span>
        <button type="button" className="underline decoration-white/20 hover:text-ink" onClick={() => onChange(nowIndex)}>
          {t.map.now}
        </button>
      </div>
      {sparkPath && (
        <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-6 w-full">
          <path d={sparkPath} fill="none" stroke={scoreColor(60)} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      <input
        type="range"
        min={0}
        max={max}
        value={hourIndex}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-score-good"
        aria-label={t.map.timeScrubber}
      />
    </div>
  );
}
