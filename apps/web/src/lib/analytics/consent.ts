export type ConsentState = "granted" | "denied";

const CONSENT_KEY = "fishmap:analytics-consent";

export function getStoredConsent(): ConsentState | null {
  const value = localStorage.getItem(CONSENT_KEY);
  return value === "granted" || value === "denied" ? value : null;
}

export function setStoredConsent(state: ConsentState) {
  localStorage.setItem(CONSENT_KEY, state);
}
