import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { getFlags, updateFlag, type FlagRow } from "@/lib/admin/client";

export function FlagsPanel() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "flags"], queryFn: getFlags });

  async function save(flag: FlagRow, patch: Partial<Pick<FlagRow, "state" | "rollout_pct">>) {
    await updateFlag(flag.key, patch.state ?? flag.state, patch.rollout_pct ?? flag.rollout_pct, flag.description);
    qc.invalidateQueries({ queryKey: ["admin", "flags"] });
  }

  if (isLoading) return <p className="text-ink-muted">{t.common.loading}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-ink">{t.admin.flags.title}</h2>
        <p className="text-sm text-ink-muted">{t.admin.flags.description}</p>
      </div>
      <div className="flex flex-col gap-3">
        {data?.map((flag) => (
          <div key={flag.key} className="rounded-lg border border-white/10 bg-ground-raised p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-ink">{flag.key}</span>
              <select
                value={flag.state}
                onChange={(e) => save(flag, { state: e.target.value as FlagRow["state"] })}
                className="rounded-md border border-white/10 bg-ground px-2 py-1 text-sm text-ink"
              >
                <option value="off">{t.admin.flags.state.off}</option>
                <option value="admin_only">{t.admin.flags.state.adminOnly}</option>
                <option value="rollout">{t.admin.flags.state.rollout}</option>
                <option value="on">{t.admin.flags.state.on}</option>
              </select>
            </div>
            {flag.description && <p className="mb-2 text-xs text-ink-muted">{flag.description}</p>}
            {flag.state === "rollout" && (
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                {t.admin.flags.rolloutPct}
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={flag.rollout_pct}
                  onChange={(e) => save(flag, { rollout_pct: Number(e.target.value) })}
                  className="w-20 rounded-md border border-white/10 bg-ground px-2 py-1 text-ink"
                />
              </label>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
