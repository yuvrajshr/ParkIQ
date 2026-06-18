import type { Dispatch, Hotspot, Warden } from "@/lib/types";
import { SEED_WARDENS } from "@/lib/seed/wardens";
import { ROAD_BY_ID } from "@/lib/seed/roads";
import { roadStateAt, parkedAt, type Intervention } from "@/lib/sim/engine";

const ONSITE_MIN = 6; // how long a warden stays on site before returning to the pool
const RELAPSE_AFTER = 18; // chronic spots refill roughly this many minutes after clearing

export function toInterventions(dispatches: Dispatch[]): Intervention[] {
  return dispatches.map((d) => ({ roadId: d.roadId, clearedAtMin: d.etaMin }));
}

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Live warden roster: status and on-map position derived from dispatches + the clock. */
export function deriveWardens(simMin: number, dispatches: Dispatch[]): Warden[] {
  return SEED_WARDENS.map((base) => {
    const active = dispatches
      .filter((d) => d.wardenId === base.id && d.dispatchedAtMin <= simMin && simMin < d.etaMin + ONSITE_MIN)
      .sort((a, b) => b.dispatchedAtMin - a.dispatchedAtMin)[0];

    if (!active) return { ...base };

    const road = ROAD_BY_ID[active.roadId];
    if (!road) return { ...base };
    if (simMin < active.etaMin) {
      const p = (simMin - active.dispatchedAtMin) / Math.max(1, active.etaMin - active.dispatchedAtMin);
      return {
        ...base,
        status: "en_route",
        assignedRoadId: active.roadId,
        point: [lerp(base.point[0], road.point[0], p), lerp(base.point[1], road.point[1], p)],
      };
    }
    return { ...base, status: "on_site", assignedRoadId: active.roadId, point: road.point };
  });
}

export interface DispatchOutcome extends Dispatch {
  arrived: boolean;
  speedAfter: number;
  recoveredKmph: number;
  relapsed: boolean;
}

/** Effectiveness of every dispatch at the current minute, plus citywide recovered speed. */
export function effectiveness(simMin: number, dispatches: Dispatch[]) {
  const interventions = toInterventions(dispatches);
  const outcomes: DispatchOutcome[] = dispatches.map((d) => {
    const road = ROAD_BY_ID[d.roadId];
    const arrived = simMin >= d.etaMin;
    const speedAfter = road ? Math.round(roadStateAt(road, simMin, interventions).observedKmph) : d.speedBefore;
    const sinceClear = simMin - d.etaMin;
    const relapsed = arrived && !!road?.chronic && sinceClear >= RELAPSE_AFTER && parkedAt(d.roadId, simMin, interventions) >= 4;
    return {
      ...d,
      arrived,
      speedAfter: arrived ? speedAfter : d.speedBefore,
      recoveredKmph: arrived ? Math.max(0, speedAfter - d.speedBefore) : 0,
      relapsed,
    };
  });

  const totalRecovered = outcomes.reduce((sum, o) => sum + o.recoveredKmph, 0);
  const arrivedCount = outcomes.filter((o) => o.arrived).length;
  const relapsed = outcomes.filter((o) => o.relapsed);
  const latest = [...outcomes].sort((a, b) => b.dispatchedAtMin - a.dispatchedAtMin)[0] ?? null;

  return { outcomes, totalRecovered, arrivedCount, relapsed, latest };
}

export function filterHotspots(hotspots: Hotspot[], zone: string, query: string): Hotspot[] {
  const q = query.trim().toLowerCase();
  return hotspots.filter((h) => {
    if (zone !== "all" && h.zone !== zone) return false;
    if (!q) return true;
    return (
      h.name.toLowerCase().includes(q) ||
      h.zone.toLowerCase().includes(q) ||
      (h.nearLandmark ?? "").toLowerCase().includes(q)
    );
  });
}
