import { useActiveLocation } from "@/location/useActiveLocation";
import { useModeStore } from "@/lib/mode/store";
import { useI18n } from "@/lib/i18n";
import { useConditions, chartWindow } from "@/lib/weather/useConditions";
import { ConditionsGate } from "@/ui/ConditionsGate";
import { ConditionPageLayout } from "@/ui/ConditionPageLayout";
import { LineChart } from "@/charts/LineChart";

export function SkyPage() {
  const { location } = useActiveLocation();
  const mode = useModeStore((s) => s.mode);
  const { bundle, isLoading, isError } = useConditions(location, mode);

  return (
    <ConditionsGate isLoading={isLoading} isError={isError}>
      {bundle && <SkyContent locationName={location.name} bundle={bundle} />}
    </ConditionsGate>
  );
}

function SkyContent({ locationName, bundle }: { locationName: string; bundle: NonNullable<ReturnType<typeof useConditions>["bundle"]> }) {
  const { t } = useI18n();
  const current = bundle.now.hour;
  const window = chartWindow(bundle.hours, bundle.nowIndex);
  const times = window.map((h) => Math.floor(new Date(h.hour.time).getTime() / 1000));

  return (
    <ConditionPageLayout
      title={t.nav.conditions.sky}
      locationLine={`${locationName} · ${bundle.series.latitude.toFixed(3)}, ${bundle.series.longitude.toFixed(3)}`}
      headline={current.temperature2m !== undefined ? `${current.temperature2m.toFixed(0)}°C` : "—"}
      summary={current.cloudCover !== undefined ? `${t.sky.cloudCover}: ${current.cloudCover.toFixed(0)}%` : ""}
      meaning={<p>{t.sky.explanation}</p>}
    >
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-1 text-xs text-ink-muted">{t.sky.cloudCover}</p>
          <LineChart
            times={times}
            series={[{ label: t.sky.cloudCover, color: "#8fa1a8", data: window.map((h) => h.hour.cloudCover ?? null) }]}
            unit="%"
          />
        </div>
        <div>
          <p className="mb-1 text-xs text-ink-muted">{t.sky.precipitation}</p>
          <LineChart
            times={times}
            series={[{ label: t.sky.precipitation, color: "#60a5fa", data: window.map((h) => h.hour.precipitation ?? null) }]}
            unit=" mm"
          />
        </div>
      </div>
    </ConditionPageLayout>
  );
}
