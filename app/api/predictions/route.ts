import { NextResponse } from "next/server";
import { getPredictionService } from "@/lib/prediction";
import { parseT, parseInterventions } from "@/lib/api/params";

export function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const t = parseT(params);
  const windowMin = Number(params.get("window")) || 45;
  const interventions = parseInterventions(params);
  const predictions = getPredictionService().upcoming(t, windowMin, interventions);
  return NextResponse.json({ t, windowMin, predictions });
}
