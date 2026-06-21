import { NextResponse } from "next/server";
import { virsFetch, mapCluster } from "@/lib/virs/proxy";

// One cluster's detail. Offline/404 → { ok:false } (HTTP 200).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await virsFetch<Parameters<typeof mapCluster>[0]>(`/clusters/${encodeURIComponent(id)}`);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error });
  return NextResponse.json({ ok: true, cluster: mapCluster(r.data) });
}
