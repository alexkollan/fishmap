import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";

interface ConditionsGateProps {
  isLoading: boolean;
  isError: boolean;
  children: ReactNode;
}

export function ConditionsGate({ isLoading, isError, children }: ConditionsGateProps) {
  const { t } = useI18n();
  if (isLoading) return <div className="px-4 py-6 text-ink-muted">{t.common.loading}</div>;
  if (isError) return <div className="px-4 py-6 text-score-bad">{t.common.error}</div>;
  return <>{children}</>;
}
