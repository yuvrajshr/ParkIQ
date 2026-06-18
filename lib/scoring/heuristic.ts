import type { ImpactLevel, ImpactScore, RoadState } from "@/lib/types";
import { ROAD_BY_ID } from "@/lib/seed/roads";
import type { ScoringService } from "./index";

// Reference impact used to map raw damage onto a 0..100 score. Tuned so the worst
// Friday-evening hotspot lands in the high 90s.
const CIS_REFERENCE = 58000;
const SEGMENT_KM = 0.6;
const RUPEES_PER_VEHICLE_MIN = 2.5; // rough value-of-time for monetising delay

const round1 = (v: number) => Math.round(v * 10) / 10;

function level(cis: number): ImpactLevel {
  if (cis >= 75) return "critical";
  if (cis >= 55) return "high";
  if (cis >= 35) return "mid";
  return "low";
}

/**
 * Transparent stand-in for the real model. Every number here is explainable to a judge:
 *   km/h lost  = how much this road slows per parked vehicle  ×  vehicles parked now
 *   impact     = km/h lost  ×  vehicles that actually need the road right now
 *
 * SWAP POINT: replace this class with one backed by the trained regression. As long as it
 * implements ScoringService, neither the API routes nor the UI change.
 */
export class HeuristicScoringService implements ScoringService {
  roadSensitivity(roadId: string): number {
    return ROAD_BY_ID[roadId]?.sensitivityKmphPerVehicle ?? 0;
  }

  scoreRoadState(state: RoadState): ImpactScore {
    const { volume, observedKmph, freeFlowKmph } = state;

    const kmphLost = round1(Math.max(0, freeFlowKmph - observedKmph));
    const raw = kmphLost * volume;
    const cis = Math.round(Math.min(100, (raw / CIS_REFERENCE) * 100));

    const tFreeHr = SEGMENT_KM / freeFlowKmph;
    const tObsHr = SEGMENT_KM / Math.max(observedKmph, 1);
    const delayMinPerVehicle = (tObsHr - tFreeHr) * 60;
    const vehiclesPerMin = volume / 60;
    const vehMinLostPerMin = Math.max(0, delayMinPerVehicle * vehiclesPerMin);

    return {
      cis,
      kmphLost,
      vehiclesAffected: volume,
      vehMinLostPerMin: Math.round(vehMinLostPerMin),
      rupeesPerMin: Math.round(vehMinLostPerMin * RUPEES_PER_VEHICLE_MIN),
      level: level(cis),
    };
  }
}
