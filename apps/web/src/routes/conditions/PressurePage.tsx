import { useActiveLocation } from "@/location/useActiveLocation";
import { useModeStore } from "@/lib/mode/store";
import { useI18n } from "@/lib/i18n";
import { useConditions, chartWindow, type HourlyConditions } from "@/lib/weather/useConditions";
import { ConditionsGate } from "@/ui/ConditionsGate";
import { ConditionPageLayout } from "@/ui/ConditionPageLayout";
import { LineChart } from "@/charts/LineChart";

export function PressurePage() {
  const { location } = useActiveLocation();
  const mode = useModeStore((s) => s.mode);
  const { bundle, isLoading, isError } = useConditions(location, mode);

  return (
    <ConditionsGate isLoading={isLoading} isError={isError}>
      {bundle && <PressureContent locationName={location.name} bundle={bundle} />}
    </ConditionsGate>
  );
}

function deltaAt(hours: HourlyConditions[], nowIndex: number, hoursBack: number): number | null {
  const idx = nowIndex - hoursBack;
  const now = hours[nowIndex]?.hour.pressureMsl;
  const past = idx >= 0 ? hours[idx]?.hour.pressureMsl : undefined;
  if (now === undefined || past === undefined) return null;
  return now - past;
}

function fmtDelta(v: number | null): string {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;
}

function PressureContent({ locationName, bundle }: { locationName: string; bundle: NonNullable<ReturnType<typeof useConditions>["bundle"]> }) {
  const { t } = useI18n();
  const current = bundle.now.hour;
  const pressureFactor = bundle.now.result.factors.find((f) => f.key === "pressure");
  const window = chartWindow(bundle.hours, bundle.nowIndex);

  const d3 = deltaAt(bundle.hours, bundle.nowIndex, 3);
  const d6 = deltaAt(bundle.hours, bundle.nowIndex, 6);
  const d24 = deltaAt(bundle.hours, bundle.nowIndex, 24);

  return (
    <ConditionPageLayout
      title={t.nav.conditions.pressure}
      locationLine={`${locationName} · ${bundle.series.latitude.toFixed(3)}, ${bundle.series.longitude.toFixed(3)}`}
      headline={current.pressureMsl !== undefined ? `${current.pressureMsl.toFixed(1)} ${t.pressure.hpa}` : "—"}
      summary={pressureFactor?.note ?? ""}
      meaning={<p>{t.pressure.explanation}</p>}
    >
      <div className="flex flex-col gap-3">
        <div className="flex gap-4 text-sm">
          <TrendStat label="3h" value={fmtDelta(d3)} />
          <TrendStat label="6h" value={fmtDelta(d6)} />
          <TrendStat label="24h" value={fmtDelta(d24)} />
        </div>
        <LineChart
          times={window.map((h) => Math.floor(new Date(h.hour.time).getTime() / 1000))}
          series={[{ label: t.pressure.trend, color: "#4ade80", data: window.map((h) => h.hour.pressureMsl ?? null) }]}
          unit=" hPa"
        />
      </div>
    </ConditionPageLayout>
  );
}

function TrendStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-ground px-3 py-2">
      <p className="font-tabular text-lg text-ink">{value}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  );
}
