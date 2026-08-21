import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getStoredConsent, setStoredConsent, type ConsentState } from "./consent";
import { isAnalyticsConfigured, loadAnalytics } from "./gtag";

interface AnalyticsContextValue {
  /** null = not yet decided (banner should show) */
  consent: ConsentState | null;
  showBanner: boolean;
  grant: () => void;
  deny: () => void;
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<ConsentState | null>(() => getStoredConsent());

  useEffect(() => {
    if (consent === "granted") loadAnalytics();
  }, [consent]);

  const value: AnalyticsContextValue = {
    consent,
    showBanner: isAnalyticsConfigured() && consent === null,
    grant: () => {
      setStoredConsent("granted");
      setConsent("granted");
    },
    deny: () => {
      setStoredConsent("denied");
      setConsent("denied");
    },
  };

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalyticsConsent(): AnalyticsContextValue {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) throw new Error("useAnalyticsConsent must be used within AnalyticsProvider");
  return ctx;
}
