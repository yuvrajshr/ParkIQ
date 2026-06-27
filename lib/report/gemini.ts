// AI narrative for the PDF report. One batched Gemini call produces the executive summary
// plus four short per-section recommendations, parsed out by marker. Fail-open: any error
// (quota, network, missing key) returns null and the PDF renders a neutral fallback line —
// generating a report must never hard-fail on the AI step.

import { GoogleGenAI } from "@google/genai";
import type { DeltaValue, ReportData, ReportNarrative } from "./types";

function fmtDate(iso: string): string {
  // Pin to IST — this runs server-side (UTC on Vercel/Docker) and the dates feed the report period.
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function pct(n: number | null): string {
  return n == null ? "n/a" : `${Math.round(n * 100)}%`;
}

function topEntry(rec: Record<string, number>): { label: string; count: number } | null {
  const entries = Object.entries(rec);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return { label: entries[0][0], count: entries[0][1] };
}

function deltaAnnotation(d: DeltaValue | null | undefined): string {
  if (!d || d.direction === "flat") return "";
  const arrow = d.direction === "up" ? "▲" : "▼";
  const magnitude = d.pct != null ? `${d.pct}%` : `${Math.abs(d.change)}`;
  return ` (${arrow}${magnitude} vs prior period)`;
}

function buildPrompt(data: ReportData): string {
  const { virs, citizenStats, cctvStats, dispatchStats, deltas } = data;
  const topCluster = virs.clusters[0];
  const topViolation = topEntry(citizenStats.byViolationType);
  const meanVirs100 = virs.summary ? Math.round(virs.summary.meanVirs * 100) : "n/a";

  return `You are a senior traffic intelligence analyst. Produce concise, evidence-driven enforcement intelligence for police operational commanders. Formal institutional prose — precision, active voice, no hedging. No markdown, no bullet points, no asterisks. Reason only from the figures below; never invent numbers.

REPORT PERIOD: ${fmtDate(data.dateRange.from)} to ${fmtDate(data.dateRange.to)}
ZONE COVERAGE: ${data.zoneLabel}

ENFORCEMENT DATA:
- VIRS hotspot clusters: ${virs.clusters.length} in scope, ${virs.severity.critical} critical, ${virs.severity.high} high severity. Mean impact-risk index: ${meanVirs100}/100.${topCluster ? ` Highest-severity location: ${topCluster.name ?? "cluster #" + topCluster.clusterId} (severity ${topCluster.severityIndex}/100, ${topCluster.count} violations, ${pct(topCluster.peakShare)} peak-hour concentration).` : ""}
- Citizen enforcement reports: ${citizenStats.total}${deltaAnnotation(deltas.citizenTotal)} submitted${topViolation ? `; leading violation type: ${topViolation.label} (${topViolation.count} cases)` : ""}. AI screening outcome: ${citizenStats.aiVerified} confirmed, ${citizenStats.aiRejected} rejected${citizenStats.avgAiConfidence != null ? `, mean confidence ${pct(citizenStats.avgAiConfidence)}` : ""}.
- CCTV detections: ${cctvStats.flagged}${deltaAnnotation(deltas.cctvFlagged)} flagged of ${cctvStats.total} frames analysed; average detection confidence ${pct(cctvStats.avgConfidence)}.
- Warden deployments: ${dispatchStats.total}${dispatchStats.avgEtaMin != null ? `; average response window ${Math.round(dispatchStats.avgEtaMin)} minutes` : ""}.

Produce EXACTLY this structure, using the markers verbatim on their own lines:

[EXECUTIVE_SUMMARY]
Three paragraphs (180–220 words total). Paragraph 1: overall congestion-risk picture — cite the top hotspot by name and the mean risk index. Paragraph 2: what the citizen and CCTV evidence shows operationally; if period-over-period deltas are present (▲/▼ figures above), name the trend explicitly. Paragraph 3: current deployment posture and the single highest-priority action the commander should direct in the next 48 hours.

[VIRS_REC]
Two sentences of actionable recommendation on cluster enforcement, citing specific severity figures and the top hotspot location.

[CITIZEN_REC]
Two sentences on the citizen-report stream — volume trend relative to the prior period and verification quality.

[CCTV_REC]
Two sentences on CCTV coverage — detection rate, confidence level, and any follow-up warranted.

[DISPATCH_REC]
Two sentences on warden deployment — response-window performance and recommended reallocation if any hotspots are under-served.`;
}

function extractSection(text: string, marker: string, nextMarkers: string[]): string {
  const start = text.indexOf(marker);
  if (start === -1) return "";
  let end = text.length;
  for (const nm of nextMarkers) {
    const idx = text.indexOf(nm, start + marker.length);
    if (idx !== -1 && idx < end) end = idx;
  }
  return text.slice(start + marker.length, end).trim();
}

/** Generate the AI narrative, or null on any failure. */
export async function generateNarrative(data: ReportData): Promise<ReportNarrative | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const result = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite",
      contents: buildPrompt(data),
    });
    const text = result.text ?? '';
    if (!text.trim()) return null;

    const executiveSummary = extractSection(text, "[EXECUTIVE_SUMMARY]", [
      "[VIRS_REC]",
      "[CITIZEN_REC]",
      "[CCTV_REC]",
      "[DISPATCH_REC]",
    ]);
    const virsRec = extractSection(text, "[VIRS_REC]", ["[CITIZEN_REC]", "[CCTV_REC]", "[DISPATCH_REC]"]);
    const citizenRec = extractSection(text, "[CITIZEN_REC]", ["[CCTV_REC]", "[DISPATCH_REC]"]);
    const cctvRec = extractSection(text, "[CCTV_REC]", ["[DISPATCH_REC]"]);
    const dispatchRec = extractSection(text, "[DISPATCH_REC]", []);

    // If the model ignored the markers, fall back to using the whole text as the summary.
    if (!executiveSummary && !virsRec) {
      return {
        executiveSummary: text.trim(),
        virsRec: "",
        citizenRec: "",
        cctvRec: "",
        dispatchRec: "",
      };
    }

    return { executiveSummary, virsRec, citizenRec, cctvRec, dispatchRec };
  } catch {
    return null;
  }
}
