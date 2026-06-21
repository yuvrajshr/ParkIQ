// Server-only proxy to the VIRS Python microservice. Keeps VIRS_SERVICE_URL off the client and
// maps the service's snake_case JSON into the app's camelCase domain types. Every call returns a
// success/offline envelope (never throws) so the dashboard degrades gracefully when the service is down.
// Only imported by server route handlers (app/api/virs/*), keeping VIRS_SERVICE_URL off the client.

import type {
  DispatchRoiItem,
  HeatPoint,
  VirsCluster,
  VirsModelCard,
  VirsSummary,
} from "@/lib/types";
import snapshot from "./snapshot.json";

// When VIRS_SERVICE_URL is set (local dev), proxy to the live Python service. When it's unset
// (production on Vercel — no Python), serve the precomputed snapshot bundled at build time.
// Regenerate the snapshot with `node dump-virs-snapshot.mjs` against a running service.
const BASE = process.env.VIRS_SERVICE_URL;

export type VirsResult<T> = { ok: true; data: T } | { ok: false; error: string };

function fromSnapshot<T>(path: string): VirsResult<T> {
  switch (path) {
    case "/summary":
      return { ok: true, data: snapshot.summary as T };
    case "/clusters":
      return { ok: true, data: snapshot.clusters as T };
    case "/dispatch-roi":
      return { ok: true, data: snapshot.dispatchRoi as T };
    case "/heatmap":
      return { ok: true, data: snapshot.heatmap as T };
    case "/model-card":
      return { ok: true, data: snapshot.modelCard as T };
  }
  if (path.startsWith("/clusters/")) {
    const id = decodeURIComponent(path.slice("/clusters/".length));
    const cluster = snapshot.clusters.find((c) => String(c.cluster_id) === id);
    return cluster
      ? { ok: true, data: cluster as T }
      : { ok: false, error: "Cluster not found" };
  }
  return { ok: false, error: `No snapshot for ${path}` };
}

export async function virsFetch<T>(path: string, init?: RequestInit): Promise<VirsResult<T>> {
  if (!BASE) return fromSnapshot<T>(path);
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, cache: "no-store" });
    if (!res.ok) return { ok: false, error: `VIRS service responded ${res.status}` };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, error: "VIRS service offline" };
  }
}

// ── snake_case → camelCase mappers ──────────────────────────────────────────────────────────────

type RawCluster = {
  cluster_id: number;
  name: string | null;
  lat: number;
  lng: number;
  avg_virs: number;
  severity_index: number;
  max_virs: number;
  count: number;
  peak_share: number;
  top_vehicle: string | null;
  vehicle_mix: Record<string, number>;
};

export const mapCluster = (c: RawCluster): VirsCluster => ({
  clusterId: c.cluster_id,
  name: c.name ?? null,
  lat: c.lat,
  lng: c.lng,
  avgVirs: c.avg_virs,
  severityIndex: c.severity_index ?? Math.round(c.avg_virs * 100),
  maxVirs: c.max_virs,
  count: c.count,
  peakShare: c.peak_share,
  topVehicle: c.top_vehicle,
  vehicleMix: c.vehicle_mix,
});

export const mapRoi = (r: RawCluster & { roi: number; roi_basis: string }): DispatchRoiItem => ({
  ...mapCluster(r),
  roi: r.roi,
  roiBasis: r.roi_basis,
});

export const mapHeat = (h: { lat: number; lng: number; weight: number }): HeatPoint => ({
  lat: h.lat,
  lng: h.lng,
  weight: h.weight,
});

export const mapSummary = (s: {
  rows: number;
  clusters: number;
  surfaced?: number;
  mean_virs: number;
  high_risk_clusters: number;
  peak_share: number;
  data_source: "real" | "fixture";
}): VirsSummary => ({
  rows: s.rows,
  clusters: s.clusters,
  surfaced: s.surfaced ?? s.clusters,
  meanVirs: s.mean_virs,
  highRiskClusters: s.high_risk_clusters,
  peakShare: s.peak_share,
  dataSource: s.data_source,
});

export const mapModelCard = (m: {
  model_type: string;
  xgboost_version: string;
  validation_auc: number;
  target_definition: string;
  known_caveats: string[];
}): VirsModelCard => ({
  modelType: m.model_type,
  xgboostVersion: m.xgboost_version,
  validationAuc: m.validation_auc,
  targetDefinition: m.target_definition,
  knownCaveats: m.known_caveats,
});
