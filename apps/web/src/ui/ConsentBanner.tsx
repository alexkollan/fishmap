import { useI18n } from "@/lib/i18n";
import { useAnalyticsConsent } from "@/lib/analytics/AnalyticsProvider";

export function ConsentBanner() {
  const { t } = useI18n();
  const { showBanner, grant, deny } = useAnalyticsConsent();

  if (!showBanner) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-30 mx-3 rounded-lg border border-white/10 bg-ground-raised p-4 shadow-lg md:bottom-4 md:left-56 md:right-4 md:mx-4">
      <p className="text-sm text-ink-muted">{t.analytics.message}</p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={deny}
          className="rounded-md px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
        >
          {t.analytics.decline}
        </button>
        <button
          type="button"
          onClick={grant}
          className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-ink hover:bg-white/20"
        >
          {t.analytics.accept}
        </button>
      </div>
    </div>
  );
}
