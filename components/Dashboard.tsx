"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSimStore } from "@/store/useSimStore";
import { getHotspots } from "@/lib/hotspots";
import { getPredictionService } from "@/lib/prediction";
import {
  toInterventions,
  deriveWardens,
  effectiveness,
  filterHotspots,
  type DispatchOutcome,
} from "@/lib/derive";
import { kmphLostTrend } from "@/lib/trend";
import DashboardHeader from "./DashboardHeader";
import HeatLegend from "./HeatLegend";
import LeftSidebar from "./LeftSidebar";
import RecentActivity from "./RecentActivity";
import PriorityQueue, { type QueueItem, type QueueStatus } from "./PriorityQueue";
import SelectedHotspot from "./SelectedHotspot";
import EffectivenessGauge from "./EffectivenessGauge";
import PredictionPanel from "./PredictionPanel";
import Toast from "./Toast";
import AiInsights from "./AiInsights";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface-2" />,
});

export default function Dashboard() {
  const simMin = useSimStore((s) => s.simMin);
  const playing = useSimStore((s) => s.playing);
  const speed = useSimStore((s) => s.speed);
  const advanceSim = useSimStore((s) => s.advanceSim);
  const dispatches = useSimStore((s) => s.dispatches);
  const filters = useSimStore((s) => s.filters);
  const selectedRoadId = useSimStore((s) => s.selectedRoadId);
  const select = useSimStore((s) => s.select);
  const dispatchTo = useSimStore((s) => s.dispatchTo);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => advanceSim(speed * 0.2), 200);
    return () => clearInterval(id);
  }, [playing, speed, advanceSim]);

  const interventions = useMemo(() => toInterventions(dispatches), [dispatches]);
  const allHotspots = useMemo(() => getHotspots(simMin, interventions), [simMin, interventions]);
  const hotspots = useMemo(
    () => filterHotspots(allHotspots, filters.zone, filters.query),
    [allHotspots, filters.zone, filters.query],
  );
  const predictions = useMemo(
    () => getPredictionService().upcoming(simMin, 45, interventions),
    [simMin, interventions],
  );
  const wardens = useMemo(() => deriveWardens(simMin, dispatches), [simMin, dispatches]);
  const eff = useMemo(() => effectiveness(simMin, dispatches), [simMin, dispatches]);

  const selected = useMemo(
    () => allHotspots.find((h) => h.roadId === selectedRoadId) ?? null,
    [allHotspots, selectedRoadId],
  );

  const kpis = useMemo(
    () =>
      allHotspots.reduce(
        (a, h) => ({
          kmph: a.kmph + h.kmphLost,
          parked: a.parked + h.parkedVehicles,
          rupees: a.rupees + h.rupeesPerMin,
        }),
        { kmph: 0, parked: 0, rupees: 0 },
      ),
    [allHotspots],
  );

  const outcomeByRoad = useMemo(() => {
    const m = new Map<string, DispatchOutcome>();
    for (const o of eff.outcomes) {
      const prev = m.get(o.roadId);
      if (!prev || o.dispatchedAtMin > prev.dispatchedAtMin) m.set(o.roadId, o);
    }
    return m;
  }, [eff]);

  const queueItems: QueueItem[] = useMemo(
    () =>
      hotspots.map((h) => {
        const o = outcomeByRoad.get(h.roadId);
        let status: QueueStatus = "none";
        let etaIn: number | undefined;
        let recovered: number | undefined;
        if (o) {
          if (!o.arrived) {
            status = "en_route";
            etaIn = Math.max(1, Math.round(o.etaMin - simMin));
          } else if (o.relapsed) {
            status = "relapsed";
          } else {
            status = "cleared";
            recovered = o.recoveredKmph;
          }
        }
        return { h, trend: kmphLostTrend(h.roadId, simMin, interventions), status, etaIn, recovered };
      }),
    [hotspots, outcomeByRoad, simMin, interventions],
  );

  const clearedNow = Math.max(0, eff.arrivedCount - eff.relapsed.length);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <DashboardHeader aiOpen={aiOpen} onAiToggle={() => setAiOpen((v) => !v)} />
      <main className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)_360px] gap-6 overflow-hidden px-8 py-6">
        {/* Left — KPI stats + Zone breakdown + WardenStrip */}
        <aside className="scroll-quiet flex min-h-0 flex-col gap-4 overflow-y-auto">
          <LeftSidebar kpis={kpis} allHotspots={allHotspots} wardens={wardens} clearedNow={clearedNow} />
        </aside>

        {/* Center — Leaflet map + bottom stats row */}
        <section className="flex min-h-0 min-w-0 flex-col gap-4">
          <div className="panel relative min-h-0 flex-1 overflow-hidden rounded-2xl">
            <HeatLegend />
            <MapView
              hotspots={hotspots}
              predictions={predictions}
              wardens={wardens}
              selectedId={selectedRoadId}
              onSelect={select}
            />
          </div>
          <div className="grid h-[210px] shrink-0 grid-cols-3 gap-4">
            <SelectedHotspot hotspot={selected} />
            <EffectivenessGauge
              recovered={eff.totalRecovered}
              cleared={clearedNow}
              relapsed={eff.relapsed.length}
            />
            <PredictionPanel predictions={predictions} simMin={simMin} onSelect={select} />
          </div>
        </section>

        {/* Right — Priority queue + Recent activity */}
        <aside className="flex min-h-0 flex-col gap-4">
          <PriorityQueue
            items={queueItems}
            selectedId={selectedRoadId}
            onSelect={select}
            onDispatch={dispatchTo}
          />
          <RecentActivity dispatches={dispatches} outcomes={eff.outcomes} />
        </aside>
      </main>
      <Toast />
      <AiInsights
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        sessionId=""
        simMin={simMin}
        hotspots={hotspots}
        predictions={predictions}
        wardens={wardens}
        dispatches={dispatches}
        kpis={kpis}
        eff={eff}
      />
    </div>
  );
}
