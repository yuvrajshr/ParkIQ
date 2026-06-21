import { NextResponse } from "next/server";
import { virsFetch, mapSummary } from "@/lib/virs/proxy";

// City-wide VIRS KPIs for the dashboard header/left panel. Offline → { ok:false } (HTTP 200).
export async function GET() {
  const r = await virsFetch<Parameters<typeof mapSummary>[0]>("/summary");
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error });
  return NextResponse.json({ ok: true, summary: mapSummary(r.data) });
}
