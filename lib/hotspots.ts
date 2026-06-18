import type { Hotspot } from "@/lib/types";
import { worldAt, type Intervention } from "@/lib/sim/engine";
import { getScoringService } from "@/lib/scoring";

const round1 = (v: number) => Math.round(v * 10) / 10;

/** The central read: the whole city, priced and ranked by Congestion Impact Score.
 *  Used identically by the API routes and the live client. */
export function getHotspots(t: number, interventions: Intervention[] = []): Hotspot[] {
  const svc = getScoringService();
  return worldAt(t, interventions)
    .map((s): Hotspot => {
      const score = svc.scoreRoadState(s);
      return {
        roadId: s.road.id,
        name: s.road.name,
        zone: s.road.zone,
        nearLandmark: s.road.nearLandmark,
        point: s.road.point,
        parkedVehicles: s.parkedVehicles,
        observedKmph: round1(s.observedKmph),
        freeFlowKmph: s.freeFlowKmph,
        chronic: s.road.chronic,
        ...score,
      };
    })
    .sort((a, b) => b.cis - a.cis);
}
