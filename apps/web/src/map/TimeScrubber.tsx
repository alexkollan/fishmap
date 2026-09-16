import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { scoreBandColor } from "@/lib/score";
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
 * Windy-style time scrubber: the whole forecast's score as a colour strip,
 * with a playhead to pick an hour. The strip is the point — it turns "when
 * should I go this week" into something answerable at a glance, before the
 * visitor has dragged anything.
 *
 * Costs nothing extra: `useConditions` already scores every hour of the
 * series for the hourly charts, so this is a second view of numbers the app
 * had computed anyway, not new data.
 *
 * Redrawn 2026-09-17 after the first version proved illegible. It painted a
 * continuous red→yellow→green gradient, and since real Greek conditions
 * cluster in the 45-75 range, a week of it came out as one flat
 * yellow-green smear with no readable structure. Two changes fixed that:
 *
 * - **Discrete band fills** (`scoreBandColor`) instead of the continuous
 *   ramp, so the strip uses the same five steps the app already names in
 *   words, and adjacent hours in different bands are actually telling apart.
 * - **A score line over the top**, which restores the fine detail that
 *   banding throws away — the bands give shape at a glance, the line gives
 *   the trend within a band.
 *
 * Drawn as one SVG with a `0 0 count 100` viewBox and
 * `preserveAspectRatio="none"`, so hour columns are integer units and
 * resizing is free; strokes carry `vector-effect="non-scaling-stroke"` so
 * that non-uniform scale doesn't smear them.
 */
export function TimeScrubber({ hours, startIndex, value, onChange }: TimeScrubberProps) {
  const { t, locale } = useI18n();
  const count = hours.length - startIndex;

  const { bands, linePoints } = useMemo(() => {
    const bandRuns: { x: number; width: number; color: string }[] = [];
    const points: string[] = [];
    let run: { x: number; width: number; color: string } | null = null;

    for (let i = 0; i < count; i++) {
      const score = hours[startIndex + i]!.result.score;
      points.push(`${i + 0.5},${100 - score}`);
      const color = scoreBandColor(score);
      // Merge equal-coloured neighbours: a week is ~156 columns, and most of
      // them share a band with the hour next door.
      if (run && run.color === color) run.width += 1;
      else {
        if (run) bandRuns.push(run);
        run = { x: i, width: 1, color };
      }
    }
    if (run) bandRuns.push(run);
    return { bands: bandRuns, linePoints: points.join(" ") };
  }, [hours, startIndex, count]);

  const dayMarks = useMemo(() => {
    const marks: { index: number; pct: number; label: string }[] = [];
    let previous = "";
    for (let i = 0; i < count; i++) {
      const iso = hours[startIndex + i]!.hour.time;
      const key = dayKeyInDisplayZone(iso);
      if (key !== previous) {
        previous = key;
        marks.push({
          index: i,
          pct: (i / count) * 100,
          label:
            marks.length === 0
              ? t.map.now
              : new Date(iso).toLocaleDateString(locale === "el" ? "el-GR" : "en-GB", {
                  weekday: "short",
                  timeZone: DISPLAY_TIME_ZONE,
                }),
        });
      }
    }
    return marks;
  }, [hours, startIndex, count, locale, t]);

  // Separator lines mark every midnight, but labels can't: the first day is
  // usually a partial one, so its boundary lands only a few percent in and
  // the weekday collides with "Now" (seen for real as "NOWTHU"). Drop any
  // label that would sit too close to the last one kept.
  const MIN_LABEL_GAP_PCT = 11;
  const labelMarks = useMemo(() => {
    const kept: typeof dayMarks = [];
    for (const mark of dayMarks) {
      const last = kept[kept.length - 1];
      if (!last || mark.pct - last.pct >= MIN_LABEL_GAP_PCT) kept.push(mark);
    }
    return kept;
  }, [dayMarks]);

  if (count <= 0) return null;

  // Clamped off the exact edges so the centred playhead isn't half-clipped
  // by the strip's rounded corners at "now" or at the end of the forecast.
  const playheadPct = Math.min(99, Math.max(1, ((value - startIndex) / Math.max(1, count - 1)) * 100));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative h-3.5">
        {labelMarks.map((mark) => (
          <span
            key={mark.index}
            className="absolute top-0 text-[10px] font-medium text-ink-muted"
            style={{ left: `${mark.pct}%`, transform: mark.index === 0 ? undefined : "translateX(3px)" }}
          >
            {mark.label}
          </span>
        ))}
      </div>

      <div className="relative h-12 overflow-hidden rounded-xl border border-white/10 bg-ground focus-within:border-score-good/60">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${count} 100`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Full opacity, deliberately. At 0.5 over the near-black ground
              the ramp collapsed — orange read as brown and yellow as olive,
              so neighbouring bands were impossible to tell apart, which was
              the whole complaint about the first version. */}
          {bands.map((band) => (
            <rect key={band.x} x={band.x} y={0} width={band.width} height={100} fill={band.color} />
          ))}
          {dayMarks.slice(1).map((mark) => (
            <line
              key={mark.index}
              x1={mark.index}
              x2={mark.index}
              y1={0}
              y2={100}
              stroke="rgb(14 20 24 / 0.55)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {/* Dark line, not light: it has to stay legible over yellow and
              lime as well as red, and white does not. */}
          <polyline
            points={linePoints}
            fill="none"
            stroke="rgb(14 20 24 / 0.75)"
            strokeWidth={1.5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div
          className="pointer-events-none absolute inset-y-0 w-1 -translate-x-1/2 rounded-full bg-ink shadow-[0_0_0_1.5px_rgba(0,0,0,0.65)]"
          style={{ left: `${playheadPct}%` }}
        />

        <input
          type="range"
          className="time-scrubber absolute inset-0 h-full w-full"
          min={startIndex}
          max={hours.length - 1}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={t.map.scrubberLabel}
          aria-valuetext={new Date(hours[value]!.hour.time).toLocaleString(locale === "el" ? "el-GR" : "en-GB", {
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: DISPLAY_TIME_ZONE,
          })}
        />
      </div>
    </div>
  );
}
