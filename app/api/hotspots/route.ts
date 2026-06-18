import { NextResponse } from "next/server";
import { getHotspots } from "@/lib/hotspots";
import { parseT, parseInterventions } from "@/lib/api/params";

// Server-side scoring: hit /api/hotspots?t=40 to see the city priced by impact.
export function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const t = parseT(params);
  const interventions = parseInterventions(params);
  return NextResponse.json({ t, hotspots: getHotspots(t, interventions) });
}
