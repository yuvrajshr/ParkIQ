// Type contracts for the controller's on-demand PDF report builder.
// Pure data — shared by the client config UI, the server aggregator, and the PDF document.

import type { VirsCluster, VirsModelCard, VirsSummary } from "@/lib/types";

/** The five geographic zones of Bengaluru, matched to the VIRS service's lat/lng banding
 *  (see lib/report/zones.ts). "All" means no zone filter. */
export type ReportZone = "All" | "Central" | "North" | "South" | "East" | "West";

export const REPORT_ZONES: ReportZone[] = [
  "All",
  "Central",
  "North",
  "South",
  "East",
  "West",
];

/** Quick date-range presets plus a fully custom range. */
export type DatePreset = "today" | "last7d" | "last30d" | "lastQuarter" | "custom";

/** Which report sections to render. Each maps to one page in the PDF. */
export interface ReportSections {
  executiveSummary: boolean;
  virsHotspots: boolean;
  citizenReports: boolean;
  cctvDetections: boolean;
  dispatchActivity: boolean;
  aiRecommendations: boolean;
  modelTransparency: boolean;
}

/** Everything the controller chooses on the /report-builder page. */
export interface ReportConfig {
  zones: ReportZone[];
  preset: DatePreset;
  customFrom?: string; // yyyy-mm-dd
  customTo?: string; // yyyy-mm-dd
  sections: ReportSections;
}

// ── Aggregated stats (computed server-side in fetchReportData) ───────────────────────────────────

export interface CitizenReportStats {
  total: number;
  byViolationType: Record<string, number>;
  byStatus: Record<string, number>;
  aiVerified: number; // ai_verdict = "violation"
  aiRejected: number; // ai_verdict = "no_violation" | "no_vehicle"
  avgAiConfidence: number | null; // mean confidence among verified, 0..1
}

export interface CameraRow {
  label: string | null;
  roadName: string | null;
  detections: number;
  maxConfidence: number; // 0..1
}

export interface CctvStats {
  total: number;
  flagged: number; // confidence > 0
  avgConfidence: number | null;
  cameras: CameraRow[];
}

export interface DispatchRow {
  id: string;
  roadName: string;
  wardenName: string;
  dispatchedAtMin: number;
  etaMin: number;
}

export interface DispatchStats {
  total: number;
  avgEtaMin: number | null;
  events: DispatchRow[];
}

/** AI-written prose (Gemini). Null when generation failed — the PDF then shows a fallback line. */
export interface ReportNarrative {
  executiveSummary: string;
  virsRec: string;
  citizenRec: string;
  cctvRec: string;
  dispatchRec: string;
}

/** A single period-over-period delta for one metric. */
export interface DeltaValue {
  change: number;
  pct: number | null; // absolute percentage change (null when prior was zero)
  direction: "up" | "down" | "flat";
}

/** Deltas computed by comparing the current period against the prior equivalent window. */
export interface PeriodDeltas {
  citizenTotal: DeltaValue | null;
  cctvFlagged: DeltaValue | null;
}

/** A zone × violation-count datum used by the VIRS bar chart. */
export interface ZoneCount {
  zone: string;
  violations: number;
}

/** Severity-tier counts used by the VIRS distribution bar. */
export interface SeverityCounts {
  critical: number; // severityIndex >= 75
  high: number; // 50..74
  mid: number; // 25..49
  low: number; // 0..24
}

/** The full payload the PDF document renders from. */
export interface ReportData {
  config: ReportConfig;
  dateRange: { from: string; to: string }; // resolved ISO strings
  generatedAt: string; // ISO timestamp
  zoneLabel: string; // human label e.g. "All zones" or "Central, North"
  virs: {
    summary: VirsSummary | null;
    clusters: VirsCluster[]; // already zone-filtered, sorted by severityIndex desc
    zoneCounts: ZoneCount[];
    severity: SeverityCounts;
    modelCard: VirsModelCard | null;
  };
  citizenStats: CitizenReportStats;
  cctvStats: CctvStats;
  dispatchStats: DispatchStats;
  narrative: ReportNarrative | null;
  deltas: PeriodDeltas;
}

/** Lightweight counts for the live outline panel (no PDF, no AI). */
export interface ReportOutline {
  dateRange: { from: string; to: string };
  zoneLabel: string;
  counts: {
    virsTotal: number;
    virsHighRisk: number;
    citizenTotal: number;
    cctvFlagged: number;
    dispatchTotal: number;
  };
}
