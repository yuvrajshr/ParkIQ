import { NextResponse } from "next/server";
import { virsFetch, mapModelCard } from "@/lib/virs/proxy";

// Honest model metadata + known caveats, surfaced in the UI. Offline → { ok:false } (HTTP 200).
export async function GET() {
  const r = await virsFetch<Parameters<typeof mapModelCard>[0]>("/model-card");
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error });
  return NextResponse.json({ ok: true, modelCard: mapModelCard(r.data) });
}
