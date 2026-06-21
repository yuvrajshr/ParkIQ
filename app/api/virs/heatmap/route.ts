import { NextResponse } from "next/server";
import { virsFetch, mapHeat } from "@/lib/virs/proxy";

// Cluster-centroid weighted points for the map heat layer. Offline → { ok:false } (HTTP 200).
export async function GET() {
  const r = await virsFetch<Parameters<typeof mapHeat>[0][]>("/heatmap");
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error });
  return NextResponse.json({ ok: true, points: r.data.map(mapHeat) });
}
