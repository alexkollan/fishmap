import type { FactorScore } from "@fishmap/types";
import { useI18n } from "@/lib/i18n";
import { scoreColor } from "@/lib/score";

interface FactorBreakdownProps {
  factors: FactorScore[];
  limit?: number;
}

// Ranked contribution breakdown, positive and negative (DEV_PLAN.md §4.13,
// §6.5) — the "why this score" panel that earns the user's trust in the
// number instead of showing a bare one.
export function FactorBreakdown({ factors, limit }: FactorBreakdownProps) {
  const { t } = useI18n();

  const ranked = factors
    .map((f) => ({ ...f, contribution: (f.score - 50) * f.weight }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, limit ?? factors.length);

  const maxAbs = Math.max(1, ...ranked.map((f) => Math.abs(f.contribution)));
  const factorLabels = t.factors as Record<string, string>;

  return (
    <ul className="flex flex-col gap-3">
      {ranked.map((f) => (
        <li key={f.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium text-ink">{factorLabels[f.key] ?? f.key}</span>
            <span className="text-right text-ink-muted">{f.note}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full transition-[width]"
              style={{ width: `${(Math.abs(f.contribution) / maxAbs) * 100}%`, backgroundColor: scoreColor(f.score) }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
