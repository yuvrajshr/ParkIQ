import { heatColor } from "@/lib/heat";
import type { ImpactLevel } from "@/lib/types";

/** Map a 0..1 VIRS score onto the app's shared low→critical heat gradient. */
export const virsColor = (avgVirs: number) =>
  heatColor(Math.max(0, Math.min(1, avgVirs)) * 100);

/** Band a 0..1 VIRS score into the same impact levels the CIS legend uses. */
export function virsBand(v: number): ImpactLevel {
  if (v >= 0.75) return "critical";
  if (v >= 0.55) return "high";
  if (v >= 0.35) return "mid";
  return "low";
}
