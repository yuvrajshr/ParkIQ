import type { ImpactLevel } from "@/lib/types";

export const LEVEL_COLOR: Record<ImpactLevel, string> = {
  low: "#2e9e6b",
  mid: "#f2a900",
  high: "#e4572e",
  critical: "#b3261e",
};

export const LEVEL_LABEL: Record<ImpactLevel, string> = {
  low: "Low impact",
  mid: "Moderate",
  high: "High impact",
  critical: "Critical",
};

const STOPS: [number, [number, number, number]][] = [
  [0, [46, 158, 107]], // heat-low
  [45, [242, 169, 0]], // heat-mid
  [70, [228, 87, 46]], // heat-high
  [92, [179, 38, 30]], // heat-critical
];

/** Continuous congestion-heat colour for a 0..100 score. */
export function heatColor(cis: number): string {
  const c = Math.max(0, Math.min(100, cis));
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [a, ca] = STOPS[i];
    const [b, cb] = STOPS[i + 1];
    if (c <= b) {
      const t = (c - a) / (b - a);
      const ch = ca.map((v, k) => Math.round(v + (cb[k] - v) * t));
      return `rgb(${ch[0]}, ${ch[1]}, ${ch[2]})`;
    }
  }
  const last = STOPS[STOPS.length - 1][1];
  return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;
}
