import { Link, useSearchParams } from "react-router-dom";
import type { FactorScore } from "@fishmap/types";
import { useActiveLocation } from "@/location/useActiveLocation";
import { useModeStore } from "@/lib/mode/store";
import { useI18n } from "@/lib/i18n";
import { useConditions, type HourlyConditions } from "@/lib/weather/useConditions";
import { formatLocalTime } from "@/lib/formatTime";
import { ConditionsGate } from "@/ui/ConditionsGate";
import { ScoreBadge } from "@/ui/ScoreBadge";
import { FactorBreakdown } from "@/ui/FactorBreakdown";
import { ModeSwitch } from "@/ui/ModeSwitch";
import { MoonIcon } from "@/ui/MoonIcon";

const GOOD_THRESHOLD = 70;
const LOOKAHEAD_HOURS = 48;

function findNextGoodWindow(hours: HourlyConditions[], nowIndex: number): HourlyConditions | null {
  const end = Math.min(hours.length, nowIndex + LOOKAHEAD_HOURS);
  let best: HourlyConditions | null = null;
  for (let i = nowIndex; i < end; i++) {
    const h = hours[i]!;
    if (h.result.score >= GOOD_THRESHOLD && (!best || h.result.score > best.result.score)) best = h;
  }
  if (best) return best;
  for (let i = nowIndex; i < end; i++) {
    const h = hours[i]!;
    if (!best || h.result.score > best.result.score) best = h;
  }
  return best;
}

function topFactorNote(factors: FactorScore[]): string | null {
  const ranked = [...factors].sort((a, b) => Math.abs(b.score - 50) * b.weight - Math.abs(a.score - 50) * a.weight);
  return ranked[0]?.note ?? null;
}

export function TodayPage() {
  const { location } = useActiveLocation();
  const mode = useModeStore((s) => s.mode);
  const { bundle, isLoading, isError } = useConditions(location, mode);
  const [searchParams] = useSearchParams();

  return (
    <ConditionsGate isLoading={isLoading} isError={isError}>
      {bundle && <TodayContent bundle={bundle} forecastSearch={searchParams.toString()} />}
    </ConditionsGate>
  );
}

function TodayContent({
  bundle,
  forecastSearch,
}: {
  bundle: NonNullable<ReturnType<typeof useConditions>["bundle"]>;
  forecastSearch: string;
}) {
  const { t, locale } = useI18n();
  const { result } = bundle.now;
  const nextGood = findNextGoodWindow(bundle.hours, bundle.nowIndex);
  const verdict = topFactorNote(result.factors);

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <ModeSwitch />

      {result.vetoes.length > 0 && (
        <div className="rounded-md border border-score-bad/30 bg-score-bad/10 px-3 py-2 text-sm text-score-bad">
          <p className="mb-1 font-medium">{t.score.activeVetoes}</p>
          {result.vetoes.map((v) => (
            <p key={v}>{v}</p>
          ))}
        </div>
      )}

      {result.caveats.length > 0 && (
        <p className="text-sm text-score-mid">{result.caveats[0]}</p>
      )}

      <div>
        <ScoreBadge score={result.score} />
        {verdict && <p className="mt-2 text-ink-muted">{verdict}</p>}
      </div>

      {nextGood && (
        <div className="rounded-lg border border-white/10 bg-ground-raised p-4">
          <p className="text-sm text-ink-muted">{t.today.nextGoodWindow}</p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-tabular text-2xl text-ink">{formatLocalTime(nextGood.hour.time, locale)}</span>
            <ScoreBadge score={nextGood.result.score} size="md" />
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-ink">{t.today.topFactors}</p>
        <FactorBreakdown factors={result.factors} limit={3} />
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-ground-raised p-4">
        <MoonIcon phase={bundle.sunMoonToday.moon.phase} size={40} />
        <div className="text-sm">
          <p className="text-ink">
            {formatLocalTime(bundle.sunMoonToday.sun.sunrise, locale)} / {formatLocalTime(bundle.sunMoonToday.sun.sunset, locale)}
          </p>
          <Link to="/conditions/sun-moon" className="text-ink-muted underline decoration-white/20 hover:text-ink">
            {t.today.sunMoonStrip}
          </Link>
        </div>
      </div>

      <Link
        to={`/forecast${forecastSearch ? `?${forecastSearch}` : ""}`}
        className="rounded-md border border-white/10 px-3 py-2 text-center text-sm text-ink hover:bg-white/5"
      >
        {t.today.seeForecast}
      </Link>
    </div>
  );
}
