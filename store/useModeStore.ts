"use client";

// Dashboard mode + selected cluster. Kept separate from useSimStore so the simulation state is
// completely untouched by the VIRS integration. VIRS is the default view.

import { create } from "zustand";
import type { DashboardMode } from "@/lib/types";

interface ModeState {
  mode: DashboardMode;
  selectedClusterId: number | null;
  setMode: (m: DashboardMode) => void;
  selectCluster: (id: number | null) => void;
}

export const useModeStore = create<ModeState>((set) => ({
  mode: "virs",
  selectedClusterId: null,
  setMode: (mode) => set({ mode }),
  selectCluster: (selectedClusterId) => set({ selectedClusterId }),
}));
