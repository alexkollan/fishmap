import { useEffect, useMemo, useState } from "react";
import { getSunMoonData } from "@fishmap/scoring";
import { useActiveLocation } from "@/location/useActiveLocation";
import { useI18n } from "@/lib/i18n";
import { moonPhaseKey } from "@/lib/moonPhaseKey";
import { formatLocalTime as formatTime, DISPLAY_TIME_ZONE } from "@/lib/formatTime";
import { MoonIcon } from "@/ui/MoonIcon";
import { SunMoonTimeline } from "@/ui/SunMoonTimeline";

export function SunMoonPage() {
  const { location } = useActiveLocation();
  const { t, locale } = useI18n();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const sunMoon = useMemo(
    () => getSunMoonData(now, location.lat, location.lon),
    [now, location.lat, location.lon],
  );

  const phaseLabel = t.sunMoon.phase[moonPhaseKey(sunMoon.moon.phase)];
  const illuminationPct = Math.round(sunMoon.moon.illumination * 100);

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{t.nav.conditions.sunMoon}</h1>
        <p className="text-sm text-ink-muted">
          {location.name} · {location.lat.toFixed(3)}, {location.lon.toFixed(3)}
        </p>
      </div>

      <p className="text-sm text-ink-muted">{t.sunMoon.offline}</p>

      <div className="flex items-center gap-4 rounded-lg border border-white/10 bg-ground-raised p-4">
        <MoonIcon phase={sunMoon.moon.phase} />
        <div>
          <p className="text-lg text-ink">{phaseLabel}</p>
          <p className="text-sm text-ink-muted">
            {t.sunMoon.illumination}: {illuminationPct}%
          </p>
        </div>
      </div>

      <SunMoonTimeline sun={sunMoon.sun} solunar={sunMoon.solunar} now={now} timeZone={DISPLAY_TIME_ZONE} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label={t.sunMoon.sunrise} value={formatTime(sunMoon.sun.sunrise, locale)} />
        <Stat label={t.sunMoon.sunset} value={formatTime(sunMoon.sun.sunset, locale)} />
        <Stat label={t.sunMoon.moonrise} value={formatTime(sunMoon.moon.moonrise, locale)} />
        <Stat label={t.sunMoon.moonset} value={formatTime(sunMoon.moon.moonset, locale)} />
        <Stat label={t.sunMoon.civilTwilight} value={`${formatTime(sunMoon.sun.civilDawn, locale)} / ${formatTime(sunMoon.sun.civilDusk, locale)}`} />
        <Stat label={t.sunMoon.nauticalTwilight} value={`${formatTime(sunMoon.sun.nauticalDawn, locale)} / ${formatTime(sunMoon.sun.nauticalDusk, locale)}`} />
      </div>

      <div className="flex flex-col gap-2">
        {sunMoon.solunar.map((w) => (
          <div
            key={w.center}
            className="flex items-center justify-between rounded-md border border-white/10 bg-ground-raised px-3 py-2 text-sm"
          >
            <span className="text-ink">{w.type === "major" ? t.sunMoon.solunarMajor : t.sunMoon.solunarMinor}</span>
            <span className="text-ink-muted">
              {formatTime(w.start, locale)}–{formatTime(w.end, locale)}
              {w.alignsWithTwilight ? " ★" : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-tabular text-lg text-ink">{value}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  );
}
