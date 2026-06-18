import type { Road, RoadState } from "@/lib/types";
import { ROADS, ROAD_BY_ID } from "@/lib/seed/roads";

// The demo replays a Friday evening: 17:30 -> 19:00.
export const SIM_START_MIN_OF_DAY = 17 * 60 + 30;
export const SIM_DURATION_MIN = 90;

/** A commander intervention: a warden reached `roadId` and cleared it at `clearedAtMin`. */
export interface Intervention {
  roadId: string;
  clearedAtMin: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const gauss = (t: number, peak: number, spread: number) =>
  Math.exp(-((t - peak) ** 2) / (2 * spread * spread));

/** Evening demand multiplier, ~0.8 at the edges rising to 1.0 at the 18:15 peak. */
export function demandFactor(t: number): number {
  return 0.72 + 0.28 * gauss(t, 45, 30);
}

const profileFor = (roadId: string) => ROAD_BY_ID[roadId];

/** Illegally parked vehicles on a road at minute t with no enforcement. */
export function baseParked(roadId: string, t: number): number {
  const p = profileFor(roadId);
  return Math.round(p.peakParked * gauss(t, p.peakMin, p.spread));
}

/** Parked vehicles accounting for any clear-out. After a warden clears a spot it empties,
 *  then refills — fast (~22 min) on chronic roads, slowly otherwise. */
export function parkedAt(roadId: string, t: number, interventions: Intervention[]): number {
  const base = baseParked(roadId, t);
  const iv = interventions
    .filter((i) => i.roadId === roadId && i.clearedAtMin <= t)
    .sort((a, b) => b.clearedAtMin - a.clearedAtMin)[0];
  if (!iv) return base;
  const road = profileFor(roadId);
  if (!road) return base;
  const refill = road.chronic ? 22 : 120;
  const suppression = clamp((t - iv.clearedAtMin) / refill, 0, 1);
  return Math.round(base * suppression);
}

export function volumeAt(road: Road, t: number): number {
  return Math.round(road.baseVolume * demandFactor(t));
}

export function observedKmph(road: Road, parked: number): number {
  return Math.max(5, road.freeFlowKmph - road.sensitivityKmphPerVehicle * parked);
}

export function roadStateAt(road: Road, t: number, interventions: Intervention[]): RoadState {
  const parkedVehicles = parkedAt(road.id, t, interventions);
  return {
    road,
    parkedVehicles,
    volume: volumeAt(road, t),
    observedKmph: observedKmph(road, parkedVehicles),
    freeFlowKmph: road.freeFlowKmph,
  };
}

export function worldAt(t: number, interventions: Intervention[] = []): RoadState[] {
  return ROADS.map((road) => roadStateAt(road, t, interventions));
}

/** Format a sim-minute as a wall clock like "6:04 PM". */
export function formatClock(t: number): string {
  const total = (SIM_START_MIN_OF_DAY + Math.round(t)) % (24 * 60);
  let hh = Math.floor(total / 60);
  const mm = total % 60;
  const ampm = hh >= 12 ? "PM" : "AM";
  hh = hh % 12 || 12;
  return `${hh}:${String(mm).padStart(2, "0")} ${ampm}`;
}
