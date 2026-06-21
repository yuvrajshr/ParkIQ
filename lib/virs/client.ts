"use client";

// Browser-side typed fetchers for the VIRS proxy routes (/api/virs/*). Each returns either the
// payload or an offline marker so callers render a clear "service offline" state without throwing.

import type {
  DispatchRoiItem,
  HeatPoint,
  VirsCluster,
  VirsModelCard,
  VirsSummary,
} from "@/lib/types";

export type Fetched<T> = { ok: true; data: T } | { ok: false; error: string };

async function get<T>(path: string, pick: (j: Record<string, unknown>) => T): Promise<Fetched<T>> {
  try {
    const res = await fetch(path, { cache: "no-store" });
    const json = (await res.json()) as Record<string, unknown>;
    if (!json.ok) return { ok: false, error: String(json.error ?? "VIRS service offline") };
    return { ok: true, data: pick(json) };
  } catch {
    return { ok: false, error: "Could not reach the server" };
  }
}

export const fetchVirsSummary = () =>
  get<VirsSummary>("/api/virs/summary", (j) => j.summary as VirsSummary);

export const fetchVirsClusters = () =>
  get<VirsCluster[]>("/api/virs/clusters", (j) => j.clusters as VirsCluster[]);

export const fetchVirsCluster = (id: number) =>
  get<VirsCluster>(`/api/virs/cluster/${id}`, (j) => j.cluster as VirsCluster);

export const fetchVirsHeatmap = () =>
  get<HeatPoint[]>("/api/virs/heatmap", (j) => j.points as HeatPoint[]);

export const fetchDispatchRoi = () =>
  get<DispatchRoiItem[]>("/api/virs/dispatch-roi", (j) => j.items as DispatchRoiItem[]);

export const fetchVirsModelCard = () =>
  get<VirsModelCard>("/api/virs/model-card", (j) => j.modelCard as VirsModelCard);
