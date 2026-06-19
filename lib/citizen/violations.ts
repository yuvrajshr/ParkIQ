import type { ViolationType } from "@/lib/types";

/** Ordered list for the citizen dropdown + server-side validation. The i18n key gives
 *  the human label (see locale files: `report.type.<key>`). */
export const VIOLATION_TYPES: { value: ViolationType; i18nKey: string }[] = [
  { value: "wrong_parking", i18nKey: "report.type.wrong_parking" },
  { value: "double_parking", i18nKey: "report.type.double_parking" },
  { value: "footpath", i18nKey: "report.type.footpath" },
  { value: "driveway", i18nKey: "report.type.driveway" },
  { value: "bus_stop_junction", i18nKey: "report.type.bus_stop_junction" },
];

const VALID = new Set<string>(VIOLATION_TYPES.map((v) => v.value));

export function isViolationType(v: string): v is ViolationType {
  return VALID.has(v);
}
