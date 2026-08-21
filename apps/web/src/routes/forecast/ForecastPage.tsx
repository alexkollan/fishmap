import { useState } from "react";
import { useActiveLocation } from "@/location/useActiveLocation";
import { useModeStore } from "@/lib/mode/store";
import { useI18n } from "@/lib/i18n";
import { useConditions, type HourlyConditions } from "@/lib/weather/useConditions";
import { formatLocalDay, formatLocalTime } from "@/lib/formatTime";
import { scoreColor } from "@/lib/score";
import { ConditionsGate } from "@/ui/ConditionsGate";
import { ScoreBadge } from "@/ui/ScoreBadge";
import { LineChart } from "@/charts/LineChart";

export function ForecastPage() {
  const { location } = useActiveLocation();
  const mode = useModeStore((s) => s.mode);
  const { bundle, isLoading, isError } = useConditions(location, mode);

  return (
    <ConditionsGate isLoading={isLoading} isError={isError}>
      {bundle && <ForecastContent bundle={bundle} />}
    </ConditionsGate>
  );
}

function ForecastContent({ bundle }: { bundle: NonNullable<ReturnType<typeof useConditions>["bundle"]> }) {
  const { t, locale } = useI18n();
  const [expanded, setExpanded] = useState<string | null>(null);

  const weekHours = bundle.hours.slice(bundle.nowIndex, Math.min(bundle.hours.length, bundle.nowIndex + 24 * 7));
  const hoursByDate = new Map<string, HourlyConditions[]>();
  for (const h of weekHours) {
    const key = h.hour.time.slice(0, 10);
    const list = hoursByDate.get(key);
    if (list) list.push(h);
    else hoursByDate.set(key, [h]);
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{t.nav.forecast}</h1>
        <p className="text-sm text-ink-muted">{t.forecast.week}</p>
      </div>

      <LineChart
        times={weekHours.map((h) => Math.floor(new Date(h.hour.time).getTime() / 1000))}
        series={[{ label: "score", color: "#4ade80", data: weekHours.map((h) => h.result.score) }]}
        height={100}
      />

      <div className="flex flex-col gap-2">
        {bundle.daily.map((day) => {
          const isOpen = expanded === day.date;
          const dayHours = hoursByDate.get(day.date) ?? [];
          return (
            <div key={day.date} className="rounded-lg border border-white/10 bg-ground-raised">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : day.date)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-ink">{formatLocalDay(day.date, locale)}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-muted">
                    {t.forecast.bestWindow}: {formatLocalTime(day.bestHour, locale)}
                  </span>
                  <ScoreBadge score={day.score} size="md" />
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-white/10 px-4 py-3">
                  <p className="mb-2 text-xs text-ink-muted">{t.forecast.hourly}</p>
                  <div className="flex flex-col gap-1">
                    {dayHours.map((h) => (
                      <div key={h.hour.time} className="flex items-center justify-between text-sm">
                        <span className="font-tabular text-ink-muted">{formatLocalTime(h.hour.time, locale)}</span>
                        <span className="font-tabular font-medium" style={{ color: scoreColor(h.result.score) }}>
                          {h.result.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
