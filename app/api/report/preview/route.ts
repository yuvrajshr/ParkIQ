import { NextResponse } from "next/server";
import { fetchReportOutline } from "@/lib/report/fetchReportData";
import type { ReportConfig } from "@/lib/report/types";

// Controller-only (proxy.ts gates everything outside /api/citizen + /api/auth).
// Returns lightweight counts for the report-builder outline panel — no PDF, no AI.
export async function POST(req: Request) {
  let config: ReportConfig;
  try {
    config = (await req.json()) as ReportConfig;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid config" }, { status: 400 });
  }

  try {
    const outline = await fetchReportOutline(config);
    return NextResponse.json({ ok: true, outline });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to build outline";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
