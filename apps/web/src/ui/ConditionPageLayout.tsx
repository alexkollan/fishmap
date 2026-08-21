import type { ReactNode } from "react";

interface ConditionPageLayoutProps {
  title: string;
  locationLine: string;
  headline: string;
  summary: string;
  children: ReactNode; // the chart(s)
  meaning: ReactNode; // "what this means for fishing"
  weighting?: ReactNode; // "how it's weighted in the score"
  caveat?: string;
}

// Shared template for every /conditions/* page (DEV_PLAN.md §6.2): current
// value -> chart -> plain-language meaning -> weight in the score. A user
// who learns to read one page already knows how to read the rest.
export function ConditionPageLayout({
  title,
  locationLine,
  headline,
  summary,
  children,
  meaning,
  weighting,
  caveat,
}: ConditionPageLayoutProps) {
  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        <p className="text-sm text-ink-muted">{locationLine}</p>
      </div>

      {caveat && (
        <p className="rounded-md border border-score-mid/30 bg-score-mid/10 px-3 py-2 text-sm text-score-mid">
          {caveat}
        </p>
      )}

      <div>
        <p className="font-tabular text-4xl text-ink">{headline}</p>
        <p className="mt-1 text-ink-muted">{summary}</p>
      </div>

      <div className="rounded-lg border border-white/10 bg-ground-raised p-3">{children}</div>

      <div className="flex flex-col gap-2 text-sm text-ink-muted">
        {meaning}
        {weighting}
      </div>
    </div>
  );
}
