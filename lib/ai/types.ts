import type { ImpactLevel, WardenStatus, VirsCluster, VirsSummary, DispatchRoiItem, VirsModelCard } from "@/lib/types";

export interface SnapshotHotspot {
  roadId: string;
  name: string;
  zone: string;
  nearLandmark?: string;
  cis: number;
  level: ImpactLevel;
  kmphLost: number;
  parkedVehicles: number;
  observedKmph: number;
  freeFlowKmph: number;
  rupeesPerMin: number;
  chronic: boolean;
}

export interface SnapshotPrediction {
  roadId: string;
  name: string;
  etaMin: number;
  projectedCis: number;
  recurring: boolean;
  reason: string;
}

export interface SnapshotWarden {
  id: string;
  name: string;
  status: WardenStatus;
  assignedRoadId?: string;
}

export interface SnapshotDispatch {
  roadId: string;
  roadName: string;
  wardenName: string;
  dispatchedAtMin: number;
  etaMin: number;
  cisBefore: number;
}

export interface SnapshotOutcome {
  roadName: string;
  wardenName: string;
  dispatchedAtMin: number;
  etaMin: number;
  cisBefore: number;
  arrived: boolean;
  recoveredKmph: number;
  relapsed: boolean;
}

export interface SimSnapshot {
  simMin: number;
  wallClock: string;
  hotspots: SnapshotHotspot[];
  predictions: SnapshotPrediction[];
  wardens: SnapshotWarden[];
  dispatches: SnapshotDispatch[];
  outcomes: SnapshotOutcome[];
  kpis: { totalKmphLost: number; totalParkedVehicles: number; totalRupeesPerMin: number };
  effectiveness: { totalRecovered: number; relapsedCount: number };
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
  snapshot: SimSnapshot;
  sessionId?: string;
}

export interface VirsChatRequest {
  message: string;
  history: ChatMessage[];
  virsContext: {
    summary: VirsSummary | null;
    clusters: VirsCluster[];
    roi: DispatchRoiItem[];
    modelCard: VirsModelCard | null;
  };
  sessionId?: string;
}
