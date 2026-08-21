import { useActiveLocation } from "@/location/useActiveLocation";
import { useModeStore } from "@/lib/mode/store";
import { useI18n } from "@/lib/i18n";
import { renderFactorNote } from "@/lib/i18n/renderFactorNote";
import { useConditions, chartWindow } from "@/lib/weather/useConditions";
import { ConditionsGate } from "@/ui/ConditionsGate";
import { ConditionPageLayout } from "@/ui/ConditionPageLayout";
import { LineChart } from "@/charts/LineChart";

export function WindPage() {
  const { location } = useActiveLocation();
  const mode = useModeStore((s) => s.mode);
  const { bundle, isLoading, isError } = useConditions(location, mode);

  return (
    <ConditionsGate isLoading={isLoading} isError={isError}>
      {bundle && <WindContent locationName={location.name} bundle={bundle} />}
    </ConditionsGate>
  );
}

function WindContent({ locationName, bundle }: { locationName: string; bundle: NonNullable<ReturnType<typeof useConditions>["bundle"]> }) {
  const { t } = useI18n();
  const current = bundle.now.hour;
  const windFactor = bundle.now.result.factors.find((f) => f.key === "wind");
  const window = chartWindow(bundle.hours, bundle.nowIndex);

  return (
    <ConditionPageLayout
      title={t.nav.conditions.wind}
      locationLine={`${locationName} · ${bundle.series.latitude.toFixed(3)}, ${bundle.series.longitude.toFixed(3)}`}
      headline={current.windSpeed10m !== undefined ? `${current.windSpeed10m.toFixed(0)} km/h` : "—"}
      summary={windFactor ? renderFactorNote(t, windFactor) : ""}
      meaning={<p>{t.wind.explanation}</p>}
    >
      <LineChart
        times={window.map((h) => Math.floor(new Date(h.hour.time).getTime() / 1000))}
        series={[
          { label: t.wind.speed, color: "#4ade80", data: window.map((h) => h.hour.windSpeed10m ?? null) },
          { label: t.wind.gusts, color: "#f87171", data: window.map((h) => h.hour.windGusts10m ?? null) },
        ]}
        unit=" km/h"
      />
    </ConditionPageLayout>
  );
}
