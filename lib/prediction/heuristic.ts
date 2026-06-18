import type { PredictedHotspot } from "@/lib/types";
import { ROADS } from "@/lib/seed/roads";
import { roadStateAt, formatClock, type Intervention } from "@/lib/sim/engine";
import { getScoringService } from "@/lib/scoring";
import type { PredictionService } from "./index";

const SPIKE_CIS = 62; // a road is "about to be a problem" above this
const ALREADY_BAD_CIS = 55; // don't forecast what is already happening
const LOOKAHEAD_STEP = 5;

/**
 * Forecasts from the recurring evening pattern: it walks each road forward and reports the
 * first minute its impact crosses the spike line — before the jam forms.
 *
 * SWAP POINT: replace with the trained forecaster. UI and API are unaffected.
 */
export class HeuristicPredictionService implements PredictionService {
  upcoming(simMin: number, windowMin: number, interventions: Intervention[]): PredictedHotspot[] {
    const svc = getScoringService();
    const out: PredictedHotspot[] = [];

    for (const road of ROADS) {
      const now = svc.scoreRoadState(roadStateAt(road, simMin, interventions)).cis;
      if (now >= ALREADY_BAD_CIS) continue;

      for (let lead = LOOKAHEAD_STEP; lead <= windowMin; lead += LOOKAHEAD_STEP) {
        const t = simMin + lead;
        const projected = svc.scoreRoadState(roadStateAt(road, t, interventions)).cis;
        if (projected >= SPIKE_CIS) {
          out.push({
            roadId: road.id,
            name: road.name,
            point: road.point,
            etaMin: t,
            projectedCis: projected,
            recurring: road.chronic,
            reason: `Likely ${projected >= 75 ? "critical" : "high"} by ${formatClock(t)}${
              road.chronic ? " · recurs Fri evenings" : ""
            }`,
          });
          break;
        }
      }
    }

    return out.sort((a, b) => a.etaMin - b.etaMin || b.projectedCis - a.projectedCis);
  }
}
