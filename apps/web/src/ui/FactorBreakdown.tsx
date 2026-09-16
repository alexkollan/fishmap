import { useState } from "react";
import type { FactorScore } from "@fishmap/types";
import { useI18n } from "@/lib/i18n";
import { renderFactorNote, renderWeightReason } from "@/lib/i18n/renderFactorNote";
import { CONTRIBUTION_DOWN, CONTRIBUTION_UP, scoreBandColor } from "@/lib/score";

interface FactorBreakdownProps {
  factors: FactorScore[];
  limit?: number;
  /** Show a "show all N factors" toggle when there are more than `limit`. */
  expandable?: boolean;
}

/** Weight shifts smaller than this are rounding, not a story worth telling
 * the user about. */
const NOTABLE_WEIGHT_SHIFT = 0.08;

// Ranked contribution breakdown, positive and negative (DEV_PLAN.md §4.13,
// §6.5) — the "why this score" panel that earns the user's trust in the
// number instead of showing a bare one.
//
// Redesigned 2026-09-17 because users couldn't read it. The old version drew
// one left-anchored bar whose *length* was |contribution| and whose *colour*
// was the factor's score, which conflated two independent things: a long
// green bar and a long red bar both meant "this mattered a lot", in opposite
// directions, with nothing marking the neutral point. Reported symptom was
// people asking what a full green bar meant versus a half green one.
//
// Now the bar diverges from a centre line: **left means this factor pulled
// the score down, right means it pushed it up**, and length is how much.
// Direction is carried by position, so colour only has to say up-or-down
// (two colours, not a ramp). The factor's own 0-100 rating moved out to its
// own number beside the bar, because that is a genuinely separate question
// from how much it moved today's total — a factor can rate 90 and still
// barely register if conditions demoted its weight.
export function FactorBreakdown({ factors, limit, expandable }: FactorBreakdownProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const ranked = factors
    .map((f) => {
      const shift = f.baseWeight > 0 ? f.weight / f.baseWeight - 1 : 0;
      return {
        ...f,
        contribution: (f.score - 50) * f.weight,
        shift,
        reasons:
          Math.abs(shift) < NOTABLE_WEIGHT_SHIFT
            ? []
            : f.modifiers.map((m) => renderWeightReason(t, m)).filter((r): r is string => r !== undefined),
      };
    })
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  const showAll = expanded || !limit;
  const visible = showAll ? ranked : ranked.slice(0, limit);
  const maxAbs = Math.max(1, ...ranked.map((f) => Math.abs(f.contribution)));
  const factorLabels = t.factors as Record<string, string>;
  const hasMore = expandable && limit !== undefined && ranked.length > limit;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[1fr_1.75rem] items-center gap-2">
        <div className="flex justify-between text-[10px] text-ink-muted">
          <span>← {t.score.lowersScore}</span>
          <span>{t.score.raisesScore} →</span>
        </div>
        <span />
      </div>

      <ul className="flex flex-col gap-3">
        {visible.map((f) => {
          const up = f.contribution >= 0;
          const halfPct = (Math.abs(f.contribution) / maxAbs) * 50;
          return (
            <li key={f.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="flex shrink-0 items-baseline gap-1.5">
                  <span className="font-medium text-ink">{factorLabels[f.key] ?? f.key}</span>
                  {f.reasons.length > 0 && (
                    <span className="whitespace-nowrap rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] leading-none text-ink-muted">
                      {f.shift > 0 ? `↑ ${t.weightReasons.countsMore}` : `↓ ${t.weightReasons.countsLess}`}
                    </span>
                  )}
                </span>
                <span className="truncate text-right text-ink-muted">{renderFactorNote(t, f)}</span>
              </div>

              <div className="grid grid-cols-[1fr_1.75rem] items-center gap-2">
                <div className="relative h-2 overflow-hidden rounded-full bg-white/5">
                  {/* Neutral axis. Drawn above the fill so it still reads as
                      a notch through a bar, and light enough to be findable
                      on the empty track when a factor contributes nothing. */}
                  <div className="absolute inset-y-0 left-1/2 z-10 w-px -translate-x-1/2 bg-ink/70" />
                  <div
                    className="absolute inset-y-0 rounded-full transition-[width,left]"
                    style={{
                      left: up ? "50%" : `${50 - halfPct}%`,
                      width: `${halfPct}%`,
                      backgroundColor: up ? CONTRIBUTION_UP : CONTRIBUTION_DOWN,
                    }}
                  />
                </div>
                <span
                  className="text-right font-tabular text-xs"
                  style={{ color: scoreBandColor(f.score) }}
                  title={t.score.factorOwnRating}
                >
                  {f.score}
                </span>
              </div>

              {f.reasons.length > 0 && <p className="text-xs leading-snug text-ink-muted/80">{f.reasons.join(" ")}</p>}
            </li>
          );
        })}
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
