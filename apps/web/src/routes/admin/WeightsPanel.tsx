import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Mode } from "@fishmap/types";
import { useI18n } from "@/lib/i18n";
import { getWeights, resetWeights, updateWeights, type WeightRow } from "@/lib/admin/client";

const MODES: Mode[] = ["shore", "boat", "spearfishing"];
const FACTOR_KEYS = ["pressure", "wind", "waves", "turbidity", "seaTemp", "light", "precipitation", "solunar", "current", "seasonality"];

export function WeightsPanel() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "weights"], queryFn: getWeights });
  const [mode, setMode] = useState<Mode>("shore");
  const [draft, setDraft] = useState<Record<string, number> | null>(null);

  const row: WeightRow | undefined = data?.find((r) => r.mode === mode);
  const weights = draft ?? row?.weights;

  async function invalidateEverywhere() {
    await Promise.all([qc.invalidateQueries({ queryKey: ["admin", "weights"] }), qc.invalidateQueries({ queryKey: ["weights"] })]);
  }

  async function save() {
    if (!weights) return;
    await updateWeights(mode, weights);
    setDraft(null);
    await invalidateEverywhere();
  }

  async function reset() {
    await resetWeights(mode);
    setDraft(null);
    await invalidateEverywhere();
  }

  if (isLoading || !weights) return <p className="text-ink-muted">{t.common.loading}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-ink">{t.admin.weights.title}</h2>
        <p className="text-sm text-ink-muted">{t.admin.weights.description}</p>
      </div>

      <div className="inline-flex w-fit rounded-lg border border-white/10 bg-ground-raised p-1">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setDraft(null);
            }}
            className={`rounded-md px-3 py-1.5 text-sm ${m === mode ? "bg-white/10 text-ink" : "text-ink-muted hover:text-ink"}`}
          >
            {t.mode[m]}
          </button>
        ))}
      </div>

      {row?.isOverridden && <p className="text-xs text-score-mid">{t.admin.weights.overridden}</p>}

      <div className="flex flex-col gap-3">
        {FACTOR_KEYS.map((key) => (
          <label key={key} className="flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between text-ink">
              <span>{t.factors[key as keyof typeof t.factors]}</span>
              <span className="font-tabular text-ink-muted">{weights[key] ?? 0}</span>
            </div>
            <input
              type="range"
              min={0}
              max={30}
              value={weights[key] ?? 0}
              onChange={(e) => setDraft({ ...weights, [key]: Number(e.target.value) })}
              className="accent-score-good"
            />
          </label>
        ))}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={save} className="rounded-md bg-white/10 px-3 py-2 text-sm text-ink hover:bg-white/20">
          {t.actions.save}
        </button>
        <button type="button" onClick={reset} className="rounded-md border border-white/10 px-3 py-2 text-sm text-ink-muted hover:text-ink">
          {t.admin.weights.reset}
        </button>
      </div>
    </div>
  );
}
