"use client";

import { create } from "zustand";
import type { Dispatch } from "@/lib/types";
import { SIM_DURATION_MIN } from "@/lib/sim/engine";

interface Filters {
  zone: string; // "all" or a zone name
  query: string;
}

interface SimState {
  simMin: number;
  playing: boolean;
  speed: number; // sim-minutes advanced per real second
  selectedRoadId: string | null;
  dispatches: Dispatch[];
  filters: Filters;
  toast: string | null;

  setSimMin: (t: number) => void;
  togglePlay: () => void;
  setPlaying: (v: boolean) => void;
  advanceSim: (dtMin: number) => void;
  reset: () => void;
  setSpeed: (s: number) => void;
  select: (roadId: string | null) => void;
  setZone: (zone: string) => void;
  setQuery: (q: string) => void;
  dispatchTo: (roadId: string) => Promise<void>;
  clearToast: () => void;
}

export const useSimStore = create<SimState>((set, get) => ({
  simMin: 32, // open near the 6pm peak: a real spread of critical/high/low, forecasts live
  playing: false,
  speed: 1.5,
  selectedRoadId: null,
  dispatches: [],
  filters: { zone: "all", query: "" },
  toast: null,

  setSimMin: (t) => set({ simMin: Math.max(0, Math.min(SIM_DURATION_MIN, t)) }),
  togglePlay: () => set((s) => ({ playing: !s.playing })),
  setPlaying: (v) => set({ playing: v }),
  advanceSim: (dtMin) =>
    set((s) => {
      const next = s.simMin + dtMin;
      if (next >= SIM_DURATION_MIN) return { simMin: SIM_DURATION_MIN, playing: false };
      return { simMin: next };
    }),
  reset: () => set({ simMin: 32, playing: false, dispatches: [], selectedRoadId: null, toast: null }),
  setSpeed: (s) => set({ speed: s }),
  select: (roadId) => set({ selectedRoadId: roadId }),
  setZone: (zone) => set((s) => ({ filters: { ...s.filters, zone } })),
  setQuery: (query) => set((s) => ({ filters: { ...s.filters, query } })),
  clearToast: () => set({ toast: null }),

  dispatchTo: async (roadId) => {
    const { simMin, dispatches } = get();
    if (dispatches.some((d) => d.roadId === roadId && simMin < d.etaMin)) {
      set({ toast: "A warden is already on the way there." });
      return;
    }
    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roadId, simMin }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        set({ toast: data.error ?? "Could not dispatch a warden." });
        return;
      }
      const d = data.dispatch as Dispatch;
      set((s) => ({
        dispatches: [...s.dispatches, d],
        toast: `${d.wardenName} dispatched to ${d.roadName} · ETA ${d.etaMin - simMin} min`,
      }));
    } catch {
      set({ toast: "Dispatch failed — check the connection." });
    }
  },
}));
