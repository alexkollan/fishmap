import { useState } from "react";
import type { FactorScore } from "@fishmap/types";
import { useI18n } from "@/lib/i18n";
import { scoreColor } from "@/lib/score";

interface FactorBreakdownProps {
  factors: FactorScore[];
  limit?: number;
  /** Show a "show all N factors" toggle when there are more than `limit`. */
  expandable?: boolean;
}

// Ranked contribution breakdown, positive and negative (DEV_PLAN.md §4.13,
// §6.5) — the "why this score" panel that earns the user's trust in the
// number instead of showing a bare one. Every factor here is computed for
// every fishing mode (packages/scoring/src/score.ts) — only the weight
// (and in a few factors, the curve) changes per mode, so this list is never
// missing an entry because of the mode chosen.
export function FactorBreakdown({ factors, limit, expandable }: FactorBreakdownProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const ranked = factors
    .map((f) => ({ ...f, contribution: (f.score - 50) * f.weight }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  const showAll = expanded || !limit;
  const visible = showAll ? ranked : ranked.slice(0, limit);
  const maxAbs = Math.max(1, ...ranked.map((f) => Math.abs(f.contribution)));
  const factorLabels = t.factors as Record<string, string>;
  const hasMore = expandable && limit !== undefined && ranked.length > limit;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {visible.map((f) => (
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
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-sm text-ink-muted underline decoration-white/20 hover:text-ink"
        >
          {expanded ? t.today.showFewerFactors : t.today.showAllFactors.replace("{count}", String(ranked.length))}
        </button>
      )}
    </div>
  );
}
