"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useModeStore } from "@/store/useModeStore";
import { useVirs } from "@/lib/hooks/useVirs";
import VirsKpis from "./virs/VirsKpis";
import ClusterDetail from "./virs/ClusterDetail";
import ModelCardNote from "./virs/ModelCardNote";
import DispatchRoiQueue from "./virs/DispatchRoiQueue";
import VirsOffline from "./virs/VirsOffline";
import VirsAiInsights from "./virs/VirsAiInsights";

const VirsMap = dynamic(() => import("./virs/VirsMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface-2" />,
});

interface Props {
  aiOpen: boolean;
  onAiClose: () => void;
}

// VIRS-primary dashboard: heatmap + ROI ranking + cluster detail, all driven by the model service.
// Sim-only panels (wardens, effectiveness, forecast, km/h KPIs) are intentionally absent — VIRS has
// no data for them. Mounts only when mode === "virs".
export default function VirsDashboard({ aiOpen, onAiClose }: Props) {
  const selectedClusterId = useModeStore((s) => s.selectedClusterId);
  const selectCluster = useModeStore((s) => s.selectCluster);
  const { data, offline, refetch } = useVirs();

  const selected = useMemo(
    () => data.clusters.find((c) => c.clusterId === selectedClusterId) ?? null,
    [data.clusters, selectedClusterId],
  );

  return (
    <>
      {offline ? (
        <VirsOffline onRetry={refetch} />
      ) : (
        <main className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)_360px] gap-6 overflow-hidden px-8 py-6">
          {/* Left — model coverage KPIs + highest-risk clusters */}
          <aside className="scroll-quiet flex min-h-0 flex-col gap-4 overflow-y-auto">
            <VirsKpis summary={data.summary} roi={data.roi} />
          </aside>

          {/* Center — heatmap + cluster detail / model card */}
          <section className="flex min-h-0 min-w-0 flex-col gap-4">
            <div className="panel relative min-h-0 flex-1 overflow-hidden rounded-2xl">
              <VirsMap
                clusters={data.clusters}
                selectedClusterId={selectedClusterId}
                onSelect={selectCluster}
              />
            </div>
            <div className="grid h-[250px] shrink-0 grid-cols-3 gap-4">
              <div className="col-span-2 min-h-0">
                <ClusterDetail cluster={selected} />
              </div>
              <ModelCardNote modelCard={data.modelCard} summary={data.summary} />
            </div>
          </section>

          {/* Right — dispatch ROI ranking */}
          <aside className="flex min-h-0 flex-col gap-4">
            <DispatchRoiQueue
              items={data.roi}
              selectedClusterId={selectedClusterId}
              onSelect={selectCluster}
            />
          </aside>
        </main>
      )}
      <VirsAiInsights open={aiOpen} onClose={onAiClose} virsData={data} />
    </>
  );
}
