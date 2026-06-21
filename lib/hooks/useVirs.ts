"use client";

// Loads everything the VIRS dashboard needs in one parallel pass and exposes a single offline
// state. If the core /clusters call fails the whole view is treated as offline (service down).

import { useCallback, useEffect, useState } from "react";
import {
  fetchDispatchRoi,
  fetchVirsClusters,
  fetchVirsHeatmap,
  fetchVirsModelCard,
  fetchVirsSummary,
} from "@/lib/virs/client";
import type {
  DispatchRoiItem,
  HeatPoint,
  VirsCluster,
  VirsModelCard,
  VirsSummary,
} from "@/lib/types";

export interface VirsData {
  summary: VirsSummary | null;
  clusters: VirsCluster[];
  roi: DispatchRoiItem[];
  heat: HeatPoint[];
  modelCard: VirsModelCard | null;
}

export interface UseVirs {
  data: VirsData;
  loading: boolean;
  offline: boolean;
  error: string | null;
  refetch: () => void;
}

const EMPTY: VirsData = { summary: null, clusters: [], roi: [], heat: [], modelCard: null };

export function useVirs(): UseVirs {
  const [data, setData] = useState<VirsData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => {
    setLoading(true);
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchVirsSummary(),
      fetchVirsClusters(),
      fetchDispatchRoi(),
      fetchVirsHeatmap(),
      fetchVirsModelCard(),
    ]).then(([s, c, r, h, m]) => {
      if (!active) return;
      if (!c.ok) {
        setOffline(true);
        setError(c.error);
        setData(EMPTY);
        setLoading(false);
        return;
      }
      setOffline(false);
      setError(null);
      setData({
        summary: s.ok ? s.data : null,
        clusters: c.data,
        roi: r.ok ? r.data : [],
        heat: h.ok ? h.data : [],
        modelCard: m.ok ? m.data : null,
      });
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [nonce]);

  return { data, loading, offline, error, refetch };
}
