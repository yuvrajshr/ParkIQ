import { NextResponse } from "next/server";
import { virsFetch, mapCluster } from "@/lib/virs/proxy";

// All scored clusters (aggregated per cluster_id). Offline → { ok:false } (HTTP 200).
export async function GET() {
  const r = await virsFetch<Parameters<typeof mapCluster>[0][]>("/clusters");
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error });
  return NextResponse.json({ ok: true, clusters: r.data.map(mapCluster) });
}
