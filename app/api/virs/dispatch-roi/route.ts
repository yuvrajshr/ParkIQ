import { NextResponse } from "next/server";
import { virsFetch, mapRoi } from "@/lib/virs/proxy";

// Clusters ranked by interim Dispatch-ROI. Offline → { ok:false } (HTTP 200).
export async function GET() {
  const r = await virsFetch<Parameters<typeof mapRoi>[0][]>("/dispatch-roi");
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error });
  return NextResponse.json({ ok: true, items: r.data.map(mapRoi) });
}
