import { ROADS } from "@/lib/seed/roads";
import { distanceKm } from "@/lib/dispatch";
import type { Road } from "@/lib/types";

/** A citizen report is matched to a seeded road only if one is within this radius.
 *  Beyond it the report is treated as free-floating (raw GPS only). */
const SNAP_RADIUS_KM = 0.25;

export interface SnappedRoad {
  road: Road;
  distanceM: number;
}

/**
 * Match a GPS fix (lat, lng) to the nearest seeded Bengaluru road within SNAP_RADIUS_KM.
 * Reuses the same haversine helper the dispatcher uses, and the shared [lng, lat]
 * convention. Returns null when nothing is close enough.
 */
export function snapToNearestRoad(lat: number, lng: number): SnappedRoad | null {
  const point: [number, number] = [lng, lat];
  let best: SnappedRoad | null = null;
  for (const road of ROADS) {
    const d = distanceKm(road.point, point);
    if (!best || d < best.distanceM / 1000) {
      best = { road, distanceM: Math.round(d * 1000) };
    }
  }
  if (!best || best.distanceM > SNAP_RADIUS_KM * 1000) return null;
  return best;
}
