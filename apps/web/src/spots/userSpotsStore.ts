import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";

export interface UserSpot {
  id: string;
  name: string;
  lat: number;
  lon: number;
  notes?: string;
  createdAt: number;
}

interface UserSpotsState {
  spots: UserSpot[];
  addSpot: (spot: Omit<UserSpot, "id" | "createdAt">) => void;
  removeSpot: (id: string) => void;
  replaceAll: (spots: UserSpot[]) => void;
}

// No accounts (DEV_PLAN.md §6.7) — user spots live only on this device, in
// IndexedDB rather than localStorage since the list can grow and IDB is the
// more appropriate store. Export/import (SpotsPage) is the only "backup"
// available without accounts.
const idbStorage = createJSONStorage<UserSpotsState>(() => ({
  getItem: async (name) => ((await idbGet(name)) ?? null),
  setItem: async (name, value) => idbSet(name, value),
  removeItem: async (name) => idbDel(name),
}));

export const useUserSpotsStore = create<UserSpotsState>()(
  persist(
    (set) => ({
      spots: [],
      addSpot: (spot) =>
        set((s) => ({
          spots: [...s.spots, { ...spot, id: crypto.randomUUID(), createdAt: Date.now() }],
        })),
      removeSpot: (id) => set((s) => ({ spots: s.spots.filter((sp) => sp.id !== id) })),
      replaceAll: (spots) => set({ spots }),
    }),
    { name: "fishmap:user-spots", storage: idbStorage },
  ),
);
