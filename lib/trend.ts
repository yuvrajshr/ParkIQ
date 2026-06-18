import { ROAD_BY_ID } from "@/lib/seed/roads";
import { roadStateAt, type Intervention } from "@/lib/sim/engine";
import { getScoringService } from "@/lib/scoring";

/** Recent km/h-lost history for a road, for the per-card sparkline. */
export function kmphLostTrend(
  roadId: string,
  simMin: number,
  interventions: Intervention[],
  points = 8,
  spanMin = 16,
): number[] {
  const road = ROAD_BY_ID[roadId];
  if (!road) return [];
  const svc = getScoringService();
  const out: number[] = [];
  for (let i = points - 1; i >= 0; i--) {
    const t = Math.max(0, simMin - (i * spanMin) / (points - 1));
    out.push(svc.scoreRoadState(roadStateAt(road, t, interventions)).kmphLost);
  }
  return out;
}
