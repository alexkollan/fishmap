import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Mode } from "@fishmap/types";

interface ModeState {
  mode: Mode;
  setMode: (mode: Mode) => void;
}

// Global fishing-mode preference (DEV_PLAN.md §4: weights differ per mode).
// The map's mode switch (§6.3, Phase 3+) will read/write the same store so
// switching mode on any page keeps the whole app consistent.
export const useModeStore = create<ModeState>()(
  persist(
    (set) => ({
      mode: "shore",
      setMode: (mode) => set({ mode }),
    }),
    { name: "fishmap:fishing-mode" },
  ),
);
