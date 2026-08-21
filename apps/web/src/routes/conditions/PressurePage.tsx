import { useI18n } from "@/lib/i18n";
import { PagePlaceholder } from "@/ui/PagePlaceholder";

export function PressurePage() {
  const { t } = useI18n();
  return <PagePlaceholder title={t.nav.conditions.pressure} />;
}
