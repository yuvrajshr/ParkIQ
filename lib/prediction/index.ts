import type { PredictedHotspot } from "@/lib/types";
import type { Intervention } from "@/lib/sim/engine";
import { HeuristicPredictionService } from "./heuristic";

/** Forecasts which roads will spike within a look-ahead window. UI/API depend only on this. */
export interface PredictionService {
  upcoming(simMin: number, windowMin: number, interventions: Intervention[]): PredictedHotspot[];
}

let instance: PredictionService | null = null;

/** Single resolution point for the forecaster. Swap the constructor for the real model. */
export function getPredictionService(): PredictionService {
  if (!instance) instance = new HeuristicPredictionService();
  return instance;
}
