import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { getStats } from "@/lib/admin/client";

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-ground-raised p-3">
      <p className="font-tabular text-2xl text-ink">{value}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  );
}

export function StatsPanel() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "stats"], queryFn: getStats });

  if (isLoading || !data) return <p className="text-ink-muted">{t.common.loading}</p>;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-medium text-ink">{t.admin.stats.title}</h2>
      <div className="grid grid-cols-2 gap-3">
        <Tile label={t.admin.stats.weatherCacheRows} value={data.weatherCacheRows} />
        <Tile label={t.admin.stats.activeSubscriptions} value={data.activePushSubscriptions} />
        <Tile label={t.admin.stats.publicSpots} value={data.publicSpots} />
        <Tile label={t.admin.stats.privateSpots} value={data.privateSpots} />
      </div>

      {data.modeDistribution.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium text-ink">{t.admin.stats.modeDistribution}</p>
          <ul className="flex flex-col gap-1 text-sm text-ink-muted">
            {data.modeDistribution.map((m) => (
              <li key={m.mode}>
                {m.mode}: {m.count}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.thresholdDistribution.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium text-ink">{t.admin.stats.thresholdDistribution}</p>
          <ul className="flex flex-col gap-1 text-sm text-ink-muted">
            {data.thresholdDistribution.map((th) => (
              <li key={th.threshold}>
                {th.threshold}: {th.count}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
