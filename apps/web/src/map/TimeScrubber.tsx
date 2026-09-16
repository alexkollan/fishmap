import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { scoreColor } from "@/lib/score";
import { DISPLAY_TIME_ZONE } from "@/lib/formatTime";
import type { HourlyConditions } from "@/lib/weather/useConditions";

interface TimeScrubberProps {
  hours: HourlyConditions[];
  /** First scrubbable hour — the present. The series carries two days of
   * history for the trend factors; none of it is fishable. */
  startIndex: number;
  /** Absolute index into `hours`. */
  value: number;
  onChange: (index: number) => void;
}

function dayKeyInDisplayZone(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: DISPLAY_TIME_ZONE });
}

/**
 * Windy-style time scrubber: the whole forecast's score rendered as a colour
 * strip, with a handle to pick an hour. The strip is the point — it turns
 * "when should I go this week" into something answerable at a glance, before
 * the visitor has dragged anything.
 *
 * Costs nothing extra to draw: `useConditions` already scores every hour of
 * the series for the hourly charts, so this is a second view of numbers the
 * app had computed anyway, not new data.
 */
export function TimeScrubber({ hours, startIndex, value, onChange }: TimeScrubberProps) {
  const { t, locale } = useI18n();
  const count = hours.length - startIndex;

  // Hard-stop gradient rather than one element per hour: ~168 hours would
  // otherwise be 168 nodes re-laid-out behind a dragging thumb.
  const gradient = useMemo(() => {
    if (count <= 0) return "transparent";
    const stops: string[] = [];
    for (let i = 0; i < count; i++) {
      const color = scoreColor(hours[startIndex + i]!.result.score);
      stops.push(`${color} ${(i / count) * 100}%`, `${color} ${((i + 1) / count) * 100}%`);
    }
    return `linear-gradient(to right, ${stops.join(", ")})`;
  }, [hours, startIndex, count]);

  // One marker per local midnight, so the strip reads as days rather than as
  // an undifferentiated 168-hour smear.
  const dayMarks = useMemo(() => {
    const marks: { pct: number; label: string }[] = [];
    let previous = "";
    for (let i = 0; i < count; i++) {
      const iso = hours[startIndex + i]!.hour.time;
      const key = dayKeyInDisplayZone(iso);
      if (key !== previous) {
        previous = key;
        marks.push({
          pct: (i / count) * 100,
          label: new Date(iso).toLocaleDateString(locale === "el" ? "el-GR" : "en-GB", {
            weekday: "short",
            timeZone: DISPLAY_TIME_ZONE,
          }),
        });
      }
    }
    return marks;
  }, [hours, startIndex, count, locale]);

  if (count <= 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-9">
        <div className="absolute inset-0 overflow-hidden rounded-md" style={{ background: gradient }} />
        {dayMarks.slice(1).map((mark) => (
          <div
            key={mark.pct}
            className="pointer-events-none absolute top-0 h-full w-px bg-ground/60"
            style={{ left: `${mark.pct}%` }}
          />
        ))}
        <input
          type="range"
          className="time-scrubber absolute inset-0 h-9"
          min={startIndex}
          max={hours.length - 1}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={t.map.scrubberLabel}
        />
      </div>
      <div className="relative h-4">
        {dayMarks.map((mark) => (
          <span
            key={mark.pct}
            className="absolute top-0 text-[10px] leading-none text-ink-muted"
            style={{ left: `${mark.pct}%`, transform: mark.pct === 0 ? undefined : "translateX(2px)" }}
          >
            {mark.label}
          </span>
        ))}
      </div>
    </div>
  );
}
