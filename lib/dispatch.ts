import type { Warden } from "@/lib/types";

const CITY_KMPH = 16; // realistic warden travel speed through evening traffic

/** Approximate ground distance between two [lng, lat] points, in km. */
export function distanceKm(a: [number, number], b: [number, number]): number {
  const latRad = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const dx = (a[0] - b[0]) * 111.32 * Math.cos(latRad);
  const dy = (a[1] - b[1]) * 110.57;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Nearest warden that is free to respond, or null if all are busy. */
export function pickNearestWarden(
  wardens: Warden[],
  target: [number, number],
): { warden: Warden; distanceKm: number } | null {
  let best: { warden: Warden; distanceKm: number } | null = null;
  for (const w of wardens) {
    if (w.status !== "available") continue;
    const d = distanceKm(w.point, target);
    if (!best || d < best.distanceKm) best = { warden: w, distanceKm: d };
  }
  return best;
}

/** Sim-minutes for a warden to reach and clear a spot, given travel distance. */
export function estimateEtaMin(distance: number): number {
  return Math.max(2, Math.round((distance / CITY_KMPH) * 60));
}
