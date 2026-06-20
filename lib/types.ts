// Shared domain types for ParkIQ. Pure data — safe to import on server and client.

export type RoadClass = "arterial" | "sub_arterial" | "collector" | "local";

export type VehicleType = "car" | "auto" | "truck" | "two_wheeler";

export type ImpactLevel = "low" | "mid" | "high" | "critical";

export type WardenStatus = "available" | "en_route" | "on_site" | "off";

/** A street segment in the dataset. `sensitivityKmphPerVehicle` is the number the ML
 *  model learns — how much speed this exact road loses per illegally parked vehicle.
 *  Seeded here as a stand-in until the real model is wired into lib/scoring. */
export interface Road {
  id: string;
  name: string;
  zone: string;
  nearLandmark?: string;
  roadClass: RoadClass;
  lanes: number;
  widthM: number;
  sensitivityKmphPerVehicle: number;
  freeFlowKmph: number;
  baseVolume: number; // vehicles/hr at full evening demand
  /** Whether the spot refills with new violations soon after it is cleared. */
  chronic: boolean;
  point: [number, number]; // [lng, lat] marker position
}

/** The state of one road at one sim-minute, before scoring. */
export interface RoadState {
  road: Road;
  parkedVehicles: number;
  volume: number; // vehicles/hr wanting the road right now
  observedKmph: number;
  freeFlowKmph: number;
}

/** What the scoring service returns for a road state. */
export interface ImpactScore {
  cis: number; // Congestion Impact Score, 0..100
  kmphLost: number; // speed the road is losing right now
  vehiclesAffected: number; // vehicles/hr using the road
  vehMinLostPerMin: number; // vehicle-minutes of delay caused each minute
  rupeesPerMin: number; // monetised cost per minute
  level: ImpactLevel;
}

/** A scored hotspot = road state + its impact score. The unit the UI ranks and maps. */
export interface Hotspot extends ImpactScore {
  roadId: string;
  name: string;
  zone: string;
  nearLandmark?: string;
  point: [number, number];
  parkedVehicles: number;
  observedKmph: number;
  freeFlowKmph: number;
  chronic: boolean;
}

/** A forecast that a road will spike soon — surfaced before the jam forms. */
export interface PredictedHotspot {
  roadId: string;
  name: string;
  point: [number, number];
  etaMin: number; // sim-minute the spike is expected
  projectedCis: number;
  recurring: boolean;
  reason: string;
}

/** A commander's decision to send a warden — recorded by POST /api/dispatch. */
export interface Dispatch {
  id: string;
  roadId: string;
  roadName: string;
  wardenId: string;
  wardenName: string;
  dispatchedAtMin: number;
  etaMin: number; // sim-minute the warden arrives and clears
  speedBefore: number;
  cisBefore: number;
}

export interface Warden {
  id: string;
  name: string;
  point: [number, number];
  status: WardenStatus;
  assignedRoadId?: string;
}

/** The kind of parking violation a citizen reports. */
export type ViolationType =
  | "wrong_parking"
  | "double_parking"
  | "footpath"
  | "driveway"
  | "bus_stop_junction";

/** Triage state of a citizen report, set by the controller. */
export type ReportStatus = "new" | "reviewed" | "resolved" | "dismissed";

/** Roboflow workflow verdict on the submitted photo. `violation` = illegal-parking model fired;
 *  `no_violation` = a vehicle is present but unflagged; `no_vehicle` = nothing vehicle-like (the
 *  only verdict that blocks submission); `skipped` = check disabled or failed open. */
export type AiVerdict = "violation" | "no_violation" | "no_vehicle" | "skipped";

/** A CCTV frame analysed by the Roboflow workflow, attached to a road. `confidence` > 0 means
 *  the illegal-parking model flagged it; 0 means a vehicle was seen but not flagged (monitoring).
 *  Pre-seeded today; a future updater rewrites these as live counts change. */
export interface CctvViolation {
  id: string;
  roadId: string;
  roadName: string | null;
  zone: string | null;
  cameraLabel: string | null;
  photoUrl: string;
  confidence: number | null;
  vehicleCount: number | null;
  detectedAt: string;
}

/** A violation reported by a citizen from the public portal: a live geo-tagged photo
 *  plus the device's GPS fix at capture time. Identity is verified app-side via phone
 *  OTP; only a masked phone is persisted (no raw PII). Shape mirrors the
 *  `public.citizen_reports` table (snake_case columns mapped to camelCase here). */
export interface CitizenReport {
  id: string;
  createdAt: string; // ISO timestamp
  violationType: ViolationType;
  note: string | null;
  lat: number;
  lng: number;
  accuracyM: number | null;
  photoUrl: string;
  /** Nearest seeded road within range, else null (free-floating report). */
  snappedRoadId: string | null;
  snappedRoadName: string | null;
  snappedZone: string | null;
  snappedDistanceM: number | null;
  reporterMasked: string; // e.g. "+91 ●●●●● ●210"
  status: ReportStatus;
  dispatchId: string | null;
  /** AI photo-verification verdict (Roboflow workflow), null on legacy rows. */
  aiVerdict: AiVerdict | null;
  /** Max illegal-parking detection confidence 0..1 (0/null when none). */
  aiConfidence: number | null;
  /** Top class label for display (violation or top vehicle class). */
  aiLabel: string | null;
}
