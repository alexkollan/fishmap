import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ActiveLocation } from "@fishmap/types";

interface LocationState {
  location: ActiveLocation | null;
  setLocation: (location: ActiveLocation) => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      location: null,
      setLocation: (location) => set({ location }),
    }),
    { name: "fishmap:active-location" },
  ),
);
