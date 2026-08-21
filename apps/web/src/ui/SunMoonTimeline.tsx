import type { SolunarWindow, SunTimes } from "@fishmap/types";

interface SunMoonTimelineProps {
  sun: SunTimes;
  solunar: SolunarWindow[];
  now: Date;
  timeZone: string;
}

function hourOfDay(iso: string | null, timeZone: string): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const parts = fmt.formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h + m / 60;
}

function pct(h: number | null): number | null {
  return h === null ? null : (h / 24) * 100;
}

// 24h timeline with solunar windows marked (DEV_PLAN.md §6.2). Segments
// crossing local midnight get visually truncated at the edge — a minor,
// acceptable simplification for a purely informational strip.
export function SunMoonTimeline({ sun, solunar, now, timeZone }: SunMoonTimelineProps) {
  const sunriseH = hourOfDay(sun.sunrise, timeZone);
  const sunsetH = hourOfDay(sun.sunset, timeZone);
  const civilDawnH = hourOfDay(sun.civilDawn, timeZone);
  const civilDuskH = hourOfDay(sun.civilDusk, timeZone);
  const nowH = hourOfDay(now.toISOString(), timeZone);

  return (
    <div className="relative h-12 w-full overflow-hidden rounded-md bg-[#0a0f13]">
      {sunriseH !== null && sunsetH !== null && sunsetH > sunriseH && (
        <div
          className="absolute inset-y-0 bg-white/10"
          style={{ left: `${pct(sunriseH)}%`, width: `${pct(sunsetH)! - pct(sunriseH)!}%` }}
        />
      )}
      {civilDawnH !== null && sunriseH !== null && sunriseH > civilDawnH && (
        <div
          className="absolute inset-y-0 bg-white/5"
          style={{ left: `${pct(civilDawnH)}%`, width: `${pct(sunriseH)! - pct(civilDawnH)!}%` }}
        />
      )}
      {civilDuskH !== null && sunsetH !== null && civilDuskH > sunsetH && (
        <div
          className="absolute inset-y-0 bg-white/5"
          style={{ left: `${pct(sunsetH)}%`, width: `${pct(civilDuskH)! - pct(sunsetH)!}%` }}
        />
      )}
      {solunar.map((w) => {
        const startH = hourOfDay(w.start, timeZone);
        const endH = hourOfDay(w.end, timeZone);
        if (startH === null || endH === null || endH <= startH) return null;
        return (
          <div
            key={w.center}
            className={`absolute inset-y-0 ${w.type === "major" ? "bg-score-good/40" : "bg-score-mid/30"}`}
            style={{ left: `${pct(startH)}%`, width: `${Math.max(pct(endH)! - pct(startH)!, 0.6)}%` }}
            title={w.type}
          />
        );
      })}
      {nowH !== null && <div className="absolute inset-y-0 w-px bg-ink" style={{ left: `${pct(nowH)}%` }} />}
    </div>
  );
}
