// Server-only aggregator for the controller's PDF report. Pulls from three sources —
// Supabase (citizen_reports, cctv_violations), the VIRS proxy (clusters/summary/model-card),
// and the in-memory dispatch store — applies the date + zone filters, and returns one
// ReportData payload the PDF document renders directly. Never imported by client code.

import { createAdminClient } from "@/lib/supabase/admin";
import { virsFetch, mapCluster, mapSummary, mapModelCard } from "@/lib/virs/proxy";
import { listDispatches } from "@/lib/db/store";
import { ROADS } from "@/lib/seed/roads";
import type { VirsCluster, VirsModelCard, VirsSummary } from "@/lib/types";
import { bengaluruZone, inSelectedZones, zoneLabel } from "./zones";
import type {
  CctvStats,
  CitizenReportStats,
  DeltaValue,
  DispatchStats,
  PeriodDeltas,
  ReportConfig,
  ReportData,
  ReportOutline,
  SeverityCounts,
  ZoneCount,
} from "./types";

// Human labels for violation types (mirrors lib/locales/en.json report.type.*).
const VIOLATION_LABELS: Record<string, string> = {
  wrong_parking: "No-parking zone",
  double_parking: "Double parking",
  footpath: "Footpath",
  driveway: "Driveway",
  bus_stop_junction: "Bus stop / junction",
};

export function violationLabel(type: string): string {
  return VIOLATION_LABELS[type] ?? type;
}

const ROAD_BY_ID = new Map(ROADS.map((r) => [r.id, r]));

// ── Date range resolution ────────────────────────────────────────────────────────────────────────

export function resolveDateRange(config: ReportConfig): { from: Date; to: Date } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const DAY = 86_400_000;

  switch (config.preset) {
    case "today":
      return { from: startOfToday, to: now };
    case "last7d":
      return { from: new Date(startOfToday.getTime() - 6 * DAY), to: now };
    case "last30d":
      return { from: new Date(startOfToday.getTime() - 29 * DAY), to: now };
    case "lastQuarter": {
      // Previous full calendar quarter.
      const q = Math.floor(now.getMonth() / 3);
      const from = new Date(now.getFullYear(), q * 3 - 3, 1);
      const to = new Date(now.getFullYear(), q * 3, 0, 23, 59, 59, 999);
      return { from, to };
    }
    case "custom": {
      const from = config.customFrom ? new Date(config.customFrom) : new Date(startOfToday.getTime() - 6 * DAY);
      const to = config.customTo
        ? new Date(config.customTo + "T23:59:59.999Z")
        : now;
      return { from, to };
    }
    default:
      // config arrives as an unchecked cast from req.json(); fall back to last-7-days
      // for an unrecognized preset rather than returning undefined and crashing the caller.
      return { from: new Date(startOfToday.getTime() - 6 * DAY), to: now };
  }
}

// ── Prior-period helpers ─────────────────────────────────────────────────────────────────────────

/** Returns the window immediately before [from, to] with the same duration. */
function resolvePriorDateRange(from: Date, to: Date): { from: Date; to: Date } {
  const duration = to.getTime() - from.getTime();
  return {
    from: new Date(from.getTime() - duration),
    to: new Date(from.getTime() - 1),
  };
}

function computeDelta(current: number, prior: number): DeltaValue {
  const change = current - prior;
  if (change === 0) return { change: 0, pct: 0, direction: "flat" };
  const direction = change > 0 ? "up" : "down";
  const pct = prior > 0 ? Math.round((Math.abs(change) / prior) * 100) : null;
  return { change, pct, direction };
}

// ── VIRS aggregation (shared by full report + outline) ─────────────────────────────────────────────

interface VirsAgg {
  summary: VirsSummary | null;
  clusters: VirsCluster[];
  zoneCounts: ZoneCount[];
  severity: SeverityCounts;
  modelCard: VirsModelCard | null;
}

const ZONE_ORDER = ["Central", "North", "South", "East", "West"] as const;

async function aggregateVirs(config: ReportConfig): Promise<VirsAgg> {
  const [clustersRes, summaryRes, cardRes] = await Promise.all([
    virsFetch<unknown[]>("/clusters"),
    virsFetch<Parameters<typeof mapSummary>[0]>("/summary"),
    virsFetch<Parameters<typeof mapModelCard>[0]>("/model-card"),
  ]);

  const allClusters: VirsCluster[] = clustersRes.ok
    ? (clustersRes.data as Parameters<typeof mapCluster>[0][]).map(mapCluster)
    : [];

  const clusters = allClusters
    .filter((c) => inSelectedZones(c.lat, c.lng, config.zones))
    .sort((a, b) => b.severityIndex - a.severityIndex);

  // Violations per zone (only zones that appear in the filtered set).
  const zoneMap = new Map<string, number>();
  for (const c of clusters) {
    const z = bengaluruZone(c.lat, c.lng);
    zoneMap.set(z, (zoneMap.get(z) ?? 0) + c.count);
  }
  const zoneCounts: ZoneCount[] = ZONE_ORDER.filter((z) => zoneMap.has(z)).map((z) => ({
    zone: z,
    violations: zoneMap.get(z)!,
  }));

  const severity: SeverityCounts = { critical: 0, high: 0, mid: 0, low: 0 };
  for (const c of clusters) {
    if (c.severityIndex >= 75) severity.critical++;
    else if (c.severityIndex >= 50) severity.high++;
    else if (c.severityIndex >= 25) severity.mid++;
    else severity.low++;
  }

  return {
    summary: summaryRes.ok ? mapSummary(summaryRes.data) : null,
    clusters,
    zoneCounts,
    severity,
    modelCard: cardRes.ok ? mapModelCard(cardRes.data) : null,
  };
}

// ── Citizen reports ───────────────────────────────────────────────────────────────────────────────

interface CitizenRowSlim {
  violation_type: string;
  status: string;
  ai_verdict: string | null;
  ai_confidence: number | null;
  lat: number;
  lng: number;
  created_at: string;
}

async function fetchCitizenRows(from: Date, to: Date): Promise<CitizenRowSlim[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("citizen_reports")
    .select("violation_type, status, ai_verdict, ai_confidence, lat, lng, created_at")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString());
  if (error || !data) return [];
  return data as CitizenRowSlim[];
}

function aggregateCitizen(rows: CitizenRowSlim[], config: ReportConfig): CitizenReportStats {
  const inZone = rows.filter((r) => inSelectedZones(r.lat, r.lng, config.zones));

  const byViolationType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let aiVerified = 0;
  let aiRejected = 0;
  let confSum = 0;
  let confCount = 0;

  for (const r of inZone) {
    const vt = violationLabel(r.violation_type);
    byViolationType[vt] = (byViolationType[vt] ?? 0) + 1;
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    if (r.ai_verdict === "violation") {
      aiVerified++;
      if (typeof r.ai_confidence === "number") {
        confSum += r.ai_confidence;
        confCount++;
      }
    } else if (r.ai_verdict === "no_violation" || r.ai_verdict === "no_vehicle") {
      aiRejected++;
    }
  }

  return {
    total: inZone.length,
    byViolationType,
    byStatus,
    aiVerified,
    aiRejected,
    avgAiConfidence: confCount > 0 ? confSum / confCount : null,
  };
}

// ── CCTV detections ───────────────────────────────────────────────────────────────────────────────

interface CctvRowSlim {
  road_id: string;
  camera_label: string | null;
  confidence: number | null;
  detected_at: string;
}

async function fetchCctvRows(from: Date, to: Date): Promise<CctvRowSlim[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("cctv_violations")
    .select("road_id, camera_label, confidence, detected_at")
    .gte("detected_at", from.toISOString())
    .lte("detected_at", to.toISOString());
  if (error || !data) return [];
  return data as CctvRowSlim[];
}

function aggregateCctv(rows: CctvRowSlim[], config: ReportConfig): CctvStats {
  // Filter by the road's geographic zone (CCTV rows carry no coordinate of their own).
  const noZoneFilter = config.zones.filter((z) => z !== "All").length === 0;
  const inZone = rows.filter((r) => {
    const road = ROAD_BY_ID.get(r.road_id);
    if (!road) return noZoneFilter; // unknown road: only when "All"
    const [lng, lat] = road.point;
    return inSelectedZones(lat, lng, config.zones);
  });

  // Group by camera.
  const byCamera = new Map<string, { label: string | null; roadId: string; detections: number; maxConf: number }>();
  let flagged = 0;
  let confSum = 0;
  let confCount = 0;

  for (const r of inZone) {
    const conf = r.confidence ?? 0;
    if (conf > 0) {
      flagged++;
      confSum += conf;
      confCount++;
    }
    const key = `${r.camera_label ?? "Camera"}::${r.road_id}`;
    const entry = byCamera.get(key) ?? { label: r.camera_label, roadId: r.road_id, detections: 0, maxConf: 0 };
    entry.detections++;
    entry.maxConf = Math.max(entry.maxConf, conf);
    byCamera.set(key, entry);
  }

  const cameras = [...byCamera.values()]
    .map((c) => ({
      label: c.label,
      roadName: ROAD_BY_ID.get(c.roadId)?.name ?? null,
      detections: c.detections,
      maxConfidence: c.maxConf,
    }))
    .sort((a, b) => b.maxConfidence - a.maxConfidence);

  return {
    total: inZone.length,
    flagged,
    avgConfidence: confCount > 0 ? confSum / confCount : null,
    cameras,
  };
}

// ── Dispatch (in-memory; not date-indexed) ──────────────────────────────────────────────────────────

function aggregateDispatch(config: ReportConfig): DispatchStats {
  const noZoneFilter = config.zones.filter((z) => z !== "All").length === 0;
  const all = listDispatches().filter((d) => {
    const road = ROAD_BY_ID.get(d.roadId);
    if (!road) return noZoneFilter;
    const [lng, lat] = road.point;
    return inSelectedZones(lat, lng, config.zones);
  });

  const events = all.map((d) => ({
    id: d.id,
    roadName: d.roadName,
    wardenName: d.wardenName,
    dispatchedAtMin: d.dispatchedAtMin,
    etaMin: d.etaMin,
  }));

  const etas = all.map((d) => d.etaMin - d.dispatchedAtMin).filter((n) => n > 0);
  const avgEtaMin = etas.length > 0 ? etas.reduce((a, b) => a + b, 0) / etas.length : null;

  return { total: all.length, avgEtaMin, events };
}

// ── Public entry points ─────────────────────────────────────────────────────────────────────────────

/** Full aggregation for PDF generation. Narrative is left null — the route fills it via Gemini. */
export async function fetchReportData(config: ReportConfig): Promise<ReportData> {
  const { from, to } = resolveDateRange(config);
  const prior = resolvePriorDateRange(from, to);

  const [virs, citizenRows, cctvRows, priorCitizenRows, priorCctvRows] = await Promise.all([
    aggregateVirs(config),
    fetchCitizenRows(from, to),
    fetchCctvRows(from, to),
    fetchCitizenRows(prior.from, prior.to),
    fetchCctvRows(prior.from, prior.to),
  ]);

  const citizenStats = aggregateCitizen(citizenRows, config);
  const cctvStats = aggregateCctv(cctvRows, config);
  const priorCitizen = aggregateCitizen(priorCitizenRows, config);
  const priorCctv = aggregateCctv(priorCctvRows, config);

  const deltas: PeriodDeltas = {
    citizenTotal: computeDelta(citizenStats.total, priorCitizen.total),
    cctvFlagged: computeDelta(cctvStats.flagged, priorCctv.flagged),
  };

  return {
    config,
    dateRange: { from: from.toISOString(), to: to.toISOString() },
    generatedAt: new Date().toISOString(),
    zoneLabel: zoneLabel(config.zones),
    virs,
    citizenStats,
    cctvStats,
    dispatchStats: aggregateDispatch(config),
    narrative: null,
    deltas,
  };
}

/** Lightweight counts for the live outline panel — no AI, no full cluster payload. */
export async function fetchReportOutline(config: ReportConfig): Promise<ReportOutline> {
  const { from, to } = resolveDateRange(config);

  const [virs, citizenRows, cctvRows] = await Promise.all([
    aggregateVirs(config),
    fetchCitizenRows(from, to),
    fetchCctvRows(from, to),
  ]);

  const cctv = aggregateCctv(cctvRows, config);
  const citizen = aggregateCitizen(citizenRows, config);
  const dispatch = aggregateDispatch(config);

  return {
    dateRange: { from: from.toISOString(), to: to.toISOString() },
    zoneLabel: zoneLabel(config.zones),
    counts: {
      virsTotal: virs.clusters.length,
      virsHighRisk: virs.severity.critical + virs.severity.high,
      citizenTotal: citizen.total,
      cctvFlagged: cctv.flagged,
      dispatchTotal: dispatch.total,
    },
  };
}
