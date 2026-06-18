import type { Dispatch, Warden } from "@/lib/types";
import { ROADS } from "@/lib/seed/roads";
import { SEED_WARDENS } from "@/lib/seed/wardens";
import { roadStateAt, type Intervention } from "@/lib/sim/engine";
import { getScoringService } from "@/lib/scoring";
import { pickNearestWarden, estimateEtaMin } from "@/lib/dispatch";

/**
 * In-memory backend state for the demo. This is the seam the Supabase data layer replaces:
 * the same four functions can be re-implemented against Postgres without touching callers.
 */
const wardens: Warden[] = SEED_WARDENS.map((w) => ({ ...w }));
const dispatches: Dispatch[] = [];

export function listWardens(): Warden[] {
  return wardens.map((w) => ({ ...w }));
}

export function listDispatches(): Dispatch[] {
  return dispatches.map((d) => ({ ...d }));
}

function interventions(): Intervention[] {
  return dispatches.map((d) => ({ roadId: d.roadId, clearedAtMin: d.etaMin }));
}

export type DispatchResult =
  | { ok: true; dispatch: Dispatch; warden: Warden }
  | { ok: false; error: string };

export function createDispatch(roadId: string, simMin: number): DispatchResult {
  const road = ROADS.find((r) => r.id === roadId);
  if (!road) return { ok: false, error: "Unknown road" };

  const pick = pickNearestWarden(wardens, road.point);
  if (!pick) return { ok: false, error: "No warden available" };

  const eta = estimateEtaMin(pick.distanceKm);
  const svc = getScoringService();
  const before = svc.scoreRoadState(roadStateAt(road, simMin, interventions()));

  const dispatch: Dispatch = {
    id: `d-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    roadId,
    roadName: road.name,
    wardenId: pick.warden.id,
    wardenName: pick.warden.name,
    dispatchedAtMin: simMin,
    etaMin: simMin + eta,
    speedBefore: Math.round(roadStateAt(road, simMin, interventions()).observedKmph),
    cisBefore: before.cis,
  };

  const w = wardens.find((x) => x.id === pick.warden.id)!;
  w.status = "en_route";
  w.assignedRoadId = roadId;
  dispatches.push(dispatch);

  return { ok: true, dispatch, warden: { ...w } };
}
