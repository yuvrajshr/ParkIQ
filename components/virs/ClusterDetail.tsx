"use client";

import type { VirsCluster } from "@/lib/types";
import { virsColor, virsBand } from "@/lib/virs/heat";
import { useTranslation } from "@/lib/hooks/useTranslation";

// VIRS-mode replacement for SelectedHotspot: the breakdown of one cluster — its mean/max risk,
// vehicle mix, and peak share. Empty state invites the user to pick a cluster on the map or list.
export default function ClusterDetail({ cluster }: { cluster: VirsCluster | null }) {
  const { t } = useTranslation();

  if (!cluster) {
    return (
      <section className="panel flex h-full flex-col rounded-2xl p-4">
        <div className="eyebrow">{t("virs.detail.title")}</div>
        <div className="flex flex-1 flex-col items-start justify-center gap-1 py-2">
          <p className="font-display text-[15px] font-semibold text-ink-soft">{t("virs.detail.selectTitle")}</p>
          <p className="text-[12px] leading-relaxed text-muted">{t("virs.detail.selectBody")}</p>
        </div>
      </section>
    );
  }

  const color = virsColor(cluster.avgVirs);
  const mix = Object.entries(cluster.vehicleMix).sort((a, b) => b[1] - a[1]);

  return (
    <section className="panel flex h-full min-h-0 flex-col overflow-hidden rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow mb-0.5">{t("virs.detail.title")}</div>
          <div className="truncate font-display text-[16px] font-bold leading-tight text-ink">
            {cluster.name ?? `Cluster ${cluster.clusterId}`}
          </div>
          <div className="truncate text-[11.5px] text-muted">
            {t("virs.detail.meta", {
              id: cluster.clusterId,
              n: cluster.count,
              pct: Math.round(cluster.peakShare * 100),
            })}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="tnum font-display text-[26px] font-bold leading-none" style={{ color }}>
            {cluster.severityIndex}
          </div>
          <div className="text-[9.5px] font-semibold uppercase tracking-wide" style={{ color }}>
            {t(`virs.band.${virsBand(cluster.avgVirs)}`)}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11.5px]">
        <span className="text-muted">{t("virs.detail.meanPeak")}</span>
        <span className="tnum font-semibold text-ink">
          {Math.round(cluster.avgVirs * 100)} / {Math.round(cluster.maxVirs * 100)}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full" style={{ width: `${cluster.avgVirs * 100}%`, background: color }} />
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted">{t("virs.detail.vehicleMix")}</div>
        <div className="scroll-quiet flex flex-col gap-1.5 overflow-y-auto pr-1">
          {mix.map(([type, share]) => (
            <div key={type} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-[11px] font-medium text-ink-soft">{type}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${share * 100}%`, background: "var(--color-primary)" }}
                />
              </div>
              <span className="tnum w-9 shrink-0 text-right text-[11px] text-muted">
                {Math.round(share * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
