import { useI18n } from "@/lib/i18n";
import { PagePlaceholder } from "@/ui/PagePlaceholder";

// This page works fully offline once built (SunCalc, computed locally,
// DEV_PLAN.md §7.6) — first genuinely useful screen, built in Phase 2.
export function SunMoonPage() {
  const { t } = useI18n();
  return <PagePlaceholder title={t.nav.conditions.sunMoon} />;
}
