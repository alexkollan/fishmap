import type { ActiveLocation, Mode } from "@fishmap/types";

export interface NotificationPrefs {
  enabled: boolean;
  locations: ActiveLocation[];
  threshold: number;
  mode: Mode;
  lookaheadHours: number;
  quietStart: string;
  quietEnd: string;
  maxFrequency: "1/day" | "1/12h" | "1/6h";
  alertTypes: ("goodWindow" | "pressureDrop" | "safety")[];
}

/** iOS only supports Web Push once the PWA is installed to the Home
 * Screen (DEV_PLAN.md §7.2) — everywhere else this is just "is the app
 * installed", which is also a reasonable gate in general. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return Boolean(iosStandalone) || window.matchMedia("(display-mode: standalone)").matches;
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Must be called from a user gesture (the Save button) — Notification
 * permission prompts on load are the fastest way to get permanently
 * denied (DEV_PLAN.md §7.3's rule applies equally to push permission). */
export async function subscribeToPush(prefs: NotificationPrefs): Promise<{ ok: true } | { ok: false; reason: "denied" | "unsupported" | "error" }> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  try {
    const keyRes = await fetch("/api/push/vapid-public-key");
    const { publicKey } = (await keyRes.json()) as { publicKey: string | null };
    if (!publicKey) return { ok: false, reason: "error" };

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }

    const json = subscription.toJSON();
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        enabled: prefs.enabled,
        locations: prefs.locations.slice(0, 5),
        threshold: prefs.threshold,
        mode: prefs.mode,
        lookaheadHours: prefs.lookaheadHours,
        quietStart: prefs.quietStart,
        quietEnd: prefs.quietEnd,
        maxFrequency: prefs.maxFrequency,
        alertTypes: prefs.alertTypes,
      }),
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
}
