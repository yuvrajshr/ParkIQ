import type { Intervention } from "@/lib/sim/engine";

/** Read the sim-minute from `?t=`, defaulting to 0. */
export function parseT(params: URLSearchParams): number {
  const t = Number(params.get("t"));
  return Number.isFinite(t) ? t : 0;
}

/** Read interventions from `?iv=roadId:clearedMin,roadId:clearedMin`. */
export function parseInterventions(params: URLSearchParams): Intervention[] {
  const raw = params.get("iv");
  if (!raw) return [];
  return raw
    .split(",")
    .map((pair) => {
      const [roadId, min] = pair.split(":");
      return { roadId, clearedAtMin: Number(min) };
    })
    .filter((iv) => iv.roadId && Number.isFinite(iv.clearedAtMin));
}
