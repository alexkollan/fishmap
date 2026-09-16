import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ActiveLocation } from "@fishmap/types";

/** How the active location got there. "manual" means the visitor deliberately
 * chose it (search result, saved spot, map tap) and it should survive across
 * visits; "auto" means the app placed it for them (geolocation, IP lookup, or
 * the Athens default), which the map's landing auto-locate is free to
 * refresh. Legacy persisted state has no source — treated as "auto", since
 * before this existed the overwhelmingly common case was the app writing its
 * own default rather than a deliberate pick. */
export type LocationSource = "auto" | "manual";

interface LocationState {
  location: ActiveLocation | null;
  source: LocationSource | null;
  setLocation: (location: ActiveLocation, source?: LocationSource) => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      location: null,
      source: null,
      setLocation: (location, source = "manual") => set({ location, source }),
    }),
    { name: "fishmap:active-location" },
  ),
);
