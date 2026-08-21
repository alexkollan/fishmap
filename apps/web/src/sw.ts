/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Injected by vite-plugin-pwa (injectManifest strategy) — the app shell
// precache list. Everything else (map data, tiles) stays runtime-fetched.
precacheAndRoute(self.__WB_MANIFEST);

interface PushPayload {
  title: string;
  body: string;
  url: string;
}

// Web Push (DEV_PLAN.md §7.4): the OS delivers the push while the app isn't
// open, so this is the only place that can turn it into a visible
// notification — a payload the SW doesn't call showNotification() for is
// silently dropped by the browser. All scheduling happens server-side
// (jobs/notifications.ts); the client only ever displays what arrives.
self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;
  let payload: PushPayload;
  try {
    payload = event.data.json() as PushPayload;
  } catch {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url },
    }),
  );
});

// Every push carries a deep link to the exact window that triggered it
// (DEV_PLAN.md §7.4) — never /map, per §5.6, so a cold start from a
// notification is never the heaviest route.
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/";

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientsList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await (client as WindowClient).navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

self.addEventListener("pushsubscriptionchange", (event: Event) => {
  // Push subscriptions can be invalidated by the browser (key rotation,
  // expiry). Re-subscribing here would need the VAPID public key, which
  // the SW doesn't carry — the app re-subscribes next time it's opened
  // (Settings page detects a missing/stale subscription on load).
  void event;
});
