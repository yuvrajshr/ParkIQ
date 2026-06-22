// Geographic zoning for report filtering. Ports the VIRS service's `_bengaluru_zone`
// (virs-service/app/data.py) so the dashboard, the Python clustering, and the PDF report
// all agree on which zone a coordinate belongs to. The service labels the catch-all "CBD";
// we surface it to the controller as "Central" for plain language.

import type { ReportZone } from "./types";

/** A concrete (non-"All") zone a coordinate can resolve to. */
export type GeoZone = Exclude<ReportZone, "All">;

/** Classify a lat/lng into one of the five Bengaluru zones. Bounds match data.py exactly. */
export function bengaluruZone(lat: number, lng: number): GeoZone {
  if (lat > 13.0) return "North";
  if (lat < 12.93) return "South";
  if (lng > 77.65) return "East";
  if (lng < 77.55) return "West";
  return "Central";
}

/** True when a coordinate passes the selected zone filter. "All" (or empty) passes everything. */
export function inSelectedZones(
  lat: number,
  lng: number,
  zones: ReportZone[],
): boolean {
  const selected = zones.filter((z) => z !== "All");
  if (selected.length === 0) return true;
  return selected.includes(bengaluruZone(lat, lng));
}

/** Human-readable label for the chosen zones, e.g. "All zones" or "Central, North". */
export function zoneLabel(zones: ReportZone[]): string {
  const selected = zones.filter((z) => z !== "All");
  if (selected.length === 0) return "All zones";
  return selected.join(", ");
}
