import type { ReactNode } from "react";
import { useActiveLocation } from "@/location/useActiveLocation";
import { useI18n } from "@/lib/i18n";

interface PagePlaceholderProps {
  title: string;
  description?: ReactNode;
}

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  const { location } = useActiveLocation();
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-2 px-4 py-6">
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      <p className="text-sm text-ink-muted">
        {location.name} · {location.lat.toFixed(3)}, {location.lon.toFixed(3)}
      </p>
      {description && <p className="text-ink-muted">{description}</p>}
      <div className="mt-4 rounded-lg border border-white/10 bg-ground-raised px-4 py-8 text-center text-ink-muted">
        {t.common.comingSoon}
      </div>
    </div>
  );
}
