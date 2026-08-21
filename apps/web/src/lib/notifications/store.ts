import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NotificationPrefs } from "@/lib/push/subscribe";

interface NotificationPrefsState {
  prefs: NotificationPrefs;
  setPrefs: (patch: Partial<NotificationPrefs>) => void;
}

// Defaults are pre-filled suggestions in the form, not silent server-side
// behaviour — nothing fires until the user explicitly saves/subscribes
// (DEV_PLAN.md §7.4). Mirrored to localStorage so Settings renders
// instantly offline even before the service worker/subscription state
// resolves.
export const useNotificationPrefsStore = create<NotificationPrefsState>()(
  persist(
    (set) => ({
      prefs: {
        enabled: false,
        locations: [],
        threshold: 80,
        mode: "shore",
        lookaheadHours: 24,
        quietStart: "23:00",
        quietEnd: "06:00",
        maxFrequency: "1/12h",
        alertTypes: ["goodWindow", "safety"],
      },
      setPrefs: (patch) => set((s) => ({ prefs: { ...s.prefs, ...patch } })),
    }),
    { name: "fishmap:notification-prefs" },
  ),
);
