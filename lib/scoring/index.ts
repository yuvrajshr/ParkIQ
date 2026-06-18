import type { ImpactScore, RoadState } from "@/lib/types";
import { HeuristicScoringService } from "./heuristic";

/**
 * The contract the rest of the app depends on. The UI and API call ONLY this — never the
 * heuristic directly — so the real ML model drops in by changing `getScoringService` below.
 */
export interface ScoringService {
  /** km/h this road loses per additional illegally parked vehicle (the learned number). */
  roadSensitivity(roadId: string): number;
  /** Price one road's current state into a Congestion Impact Score and its components. */
  scoreRoadState(state: RoadState): ImpactScore;
}

let instance: ScoringService | null = null;

/** Single resolution point for the scoring model. Swap the constructor here for the real one. */
export function getScoringService(): ScoringService {
  if (!instance) instance = new HeuristicScoringService();
  return instance;
}

/** Convenience: score a batch of road states in one call. */
export function scoreAll(states: RoadState[]): ImpactScore[] {
  const svc = getScoringService();
  return states.map((s) => svc.scoreRoadState(s));
}
