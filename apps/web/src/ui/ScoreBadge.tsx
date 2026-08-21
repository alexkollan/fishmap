import { useI18n } from "@/lib/i18n";
import { scoreBandKey, scoreColor } from "@/lib/score";

interface ScoreBadgeProps {
  score: number;
  size?: "lg" | "md";
}

// One accent ramp for the score, used only for the score (DEV_PLAN.md §6.9)
// — a 5-band label is the primary read, the number is secondary (§11.4).
export function ScoreBadge({ score, size = "lg" }: ScoreBadgeProps) {
  const { t } = useI18n();
  const color = scoreColor(score);
  const band = t.score.bands[scoreBandKey(score)];

  return (
    <div className="flex items-baseline gap-3">
      <span
        className={size === "lg" ? "font-tabular text-6xl font-semibold" : "font-tabular text-3xl font-semibold"}
        style={{ color }}
      >
        {score}
      </span>
      <span className="text-lg text-ink-muted">{band}</span>
    </div>
  );
}
