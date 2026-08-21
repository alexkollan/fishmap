import { useI18n } from "@/lib/i18n";
import { PagePlaceholder } from "@/ui/PagePlaceholder";

// MapLibre lands here in Phase 3+ as a lazy chunk (DEV_PLAN.md §5.6) — this
// route must never pull map libraries into the shared bundle.
export function MapPage() {
  const { t } = useI18n();
  return <PagePlaceholder title={t.nav.map} />;
}

export default MapPage;
