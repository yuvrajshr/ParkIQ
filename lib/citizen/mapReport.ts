import type { AiVerdict, CitizenReport, ReportStatus, ViolationType } from "@/lib/types";

/** Shape of a `public.citizen_reports` row as returned by Supabase (snake_case). */
export interface CitizenReportRow {
  id: string;
  created_at: string;
  violation_type: string;
  note: string | null;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  photo_url: string;
  snapped_road_id: string | null;
  snapped_road_name: string | null;
  snapped_zone: string | null;
  snapped_distance_m: number | null;
  reporter_masked: string;
  status: string;
  dispatch_id: string | null;
  ai_verdict: string | null;
  ai_confidence: number | null;
  ai_label: string | null;
}

/** Map a DB row to the camelCase domain type the UI uses. */
export function mapReport(row: CitizenReportRow): CitizenReport {
  return {
    id: row.id,
    createdAt: row.created_at,
    violationType: row.violation_type as ViolationType,
    note: row.note,
    lat: row.lat,
    lng: row.lng,
    accuracyM: row.accuracy_m,
    photoUrl: row.photo_url,
    snappedRoadId: row.snapped_road_id,
    snappedRoadName: row.snapped_road_name,
    snappedZone: row.snapped_zone,
    snappedDistanceM: row.snapped_distance_m,
    reporterMasked: row.reporter_masked,
    status: row.status as ReportStatus,
    dispatchId: row.dispatch_id,
    aiVerdict: (row.ai_verdict as AiVerdict | null) ?? null,
    aiConfidence: row.ai_confidence,
    aiLabel: row.ai_label,
  };
}
