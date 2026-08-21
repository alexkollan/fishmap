declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

let loaded = false;

function gtag(...args: unknown[]) {
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(args);
}

/** No-ops if no Measurement ID is configured — safe to call unconditionally. */
export function isAnalyticsConfigured(): boolean {
  return Boolean(MEASUREMENT_ID);
}

/**
 * Loads gtag.js and initializes GA4. Must only be called after consent is
 * granted (DEV_PLAN has no explicit analytics policy, but this app targets
 * EU/Greek visitors — GDPR requires the tracking script not load pre-consent,
 * not just that events be withheld).
 */
export function loadAnalytics() {
  if (loaded || !MEASUREMENT_ID) return;
  loaded = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer ?? [];
  // loadAnalytics() only runs after our own consent banner has already
  // been accepted (AnalyticsProvider) — Google's tags default new consent
  // state to "denied" and silently withhold hits without this, regardless
  // of the config/event calls below.
  gtag("consent", "default", {
    ad_storage: "granted",
    analytics_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
  });
  gtag("js", new Date());
  // Manual page_view dispatch — see usePageViewTracking. This is an SPA;
  // gtag's automatic pageview only fires once on script load.
  gtag("config", MEASUREMENT_ID, { send_page_view: false });
}

export function trackPageView(path: string) {
  if (!loaded) return;
  gtag("event", "page_view", { page_path: path });
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (!loaded) return;
  gtag("event", name, params);
}
