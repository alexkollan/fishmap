import { useActiveLocation } from "@/location/useActiveLocation";
import { useModeStore } from "@/lib/mode/store";
import { useI18n } from "@/lib/i18n";
import { renderFactorNote } from "@/lib/i18n/renderFactorNote";
import { useConditions, chartWindow } from "@/lib/weather/useConditions";
import { ConditionsGate } from "@/ui/ConditionsGate";
import { ConditionPageLayout } from "@/ui/ConditionPageLayout";
import { LineChart } from "@/charts/LineChart";

export function SeaPage() {
  const { location } = useActiveLocation();
  const mode = useModeStore((s) => s.mode);
  const { bundle, isLoading, isError } = useConditions(location, mode);

  return (
    <ConditionsGate isLoading={isLoading} isError={isError}>
      {bundle && <SeaContent locationName={location.name} bundle={bundle} />}
    </ConditionsGate>
  );
}

function SeaContent({ locationName, bundle }: { locationName: string; bundle: NonNullable<ReturnType<typeof useConditions>["bundle"]> }) {
  const { t } = useI18n();
  const current = bundle.now.hour;
  const turbidityFactor = bundle.now.result.factors.find((f) => f.key === "turbidity");
  const window = chartWindow(bundle.hours, bundle.nowIndex);
  const times = window.map((h) => Math.floor(new Date(h.hour.time).getTime() / 1000));

  return (
    <ConditionPageLayout
      title={t.nav.conditions.sea}
      locationLine={`${locationName} · ${bundle.series.latitude.toFixed(3)}, ${bundle.series.longitude.toFixed(3)}`}
      headline={current.waveHeight !== undefined ? `${current.waveHeight.toFixed(1)} m` : "—"}
      summary={current.seaSurfaceTemperature !== undefined ? `${t.sea.seaTemp}: ${current.seaSurfaceTemperature.toFixed(1)}°C` : ""}
      caveat={bundle.now.result.caveats[0]}
      meaning={
        <>
          <p>{t.sea.explanation}</p>
          {turbidityFactor && (
            <p className="mt-2">
              {t.sea.clarity}: {renderFactorNote(t, turbidityFactor)}
            </p>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-1 text-xs text-ink-muted">{t.sea.waveHeight} / {t.sea.swell}</p>
          <LineChart
            times={times}
            series={[
              { label: t.sea.waveHeight, color: "#4ade80", data: window.map((h) => h.hour.waveHeight ?? null) },
              { label: t.sea.swell, color: "#60a5fa", data: window.map((h) => h.hour.swellWaveHeight ?? null) },
            ]}
            unit=" m"
          />
        </div>
        <div>
          <p className="mb-1 text-xs text-ink-muted">{t.sea.seaTemp}</p>
          <LineChart
            times={times}
            series={[{ label: t.sea.seaTemp, color: "#facc15", data: window.map((h) => h.hour.seaSurfaceTemperature ?? null) }]}
            unit="°C"
          />
        </div>
      </div>
    </ConditionPageLayout>
  );
}
