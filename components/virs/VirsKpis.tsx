"use client";

import type { DispatchRoiItem, VirsSummary } from "@/lib/types";
import { virsColor } from "@/lib/virs/heat";
import { useTranslation } from "@/lib/hooks/useTranslation";

// Left-panel KPIs for VIRS mode — replaces the simulation's km/h·parked·rupees stats with the
// model's own coverage numbers, plus a ranked list of the highest-impact hotspots.
export default function VirsKpis({
  summary,
  roi,
}: {
  summary: VirsSummary | null;
  roi: DispatchRoiItem[];
}) {
  const { t } = useTranslation();
  // Severity (avg VIRS) saturates at ~100 for every top hotspot, so it can't order them. These are
  // all top-severity zones; rank this glance list by violation volume instead, so both the bars and
  // the numbers vary and stay monotonic. The ROI dispatch queue on the right adds the peak weighting.
  const top = [...roi].sort((a, b) => b.count - a.count).slice(0, 6);
  const maxCount = Math.max(1, ...top.map((c) => c.count));

  return (
    <>
      <div className="panel shrink-0 rounded-2xl p-5">
        <div className="eyebrow mb-4">{t("virs.kpi.coverage")}</div>
        <div className="grid grid-cols-2 gap-3">
          <Metric
            label={t("virs.kpi.clustersScored")}
            value={summary?.clusters ?? "—"}
            unit={t("virs.kpi.hotspotZones")}
            color="var(--color-primary)"
          />
          <Metric
            label={t("virs.kpi.meanRisk")}
            value={summary ? Math.round(summary.meanVirs * 100) : "—"}
            unit={t("virs.kpi.virsPer100")}
            color="var(--color-heat-high)"
          />
          <Metric
            label={t("virs.kpi.highRisk")}
            value={summary?.highRiskClusters ?? "—"}
            unit={t("virs.kpi.highRiskUnit")}
            color="var(--color-heat-critical)"
          />
          <Metric
            label={t("virs.kpi.peakShare")}
            value={summary ? `${Math.round(summary.peakShare * 100)}%` : "—"}
            unit={t("virs.kpi.ofViolations")}
            color="var(--color-accent)"
          />
        </div>
      </div>

      <div className="panel shrink-0 rounded-2xl p-5">
        <div className="eyebrow mb-1">{t("virs.kpi.topSeverity")}</div>
        <p className="mb-4 text-[10.5px] text-muted">{t("virs.kpi.topSeveritySub")}</p>
        {top.length === 0 ? (
          <p className="text-xs text-muted">{t("virs.kpi.empty")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {top.map((c) => (
              <RiskBar key={c.clusterId} item={c} maxCount={maxCount} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number | string;
  unit: string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl p-3.5"
      style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-line)" }}
    >
      <div className="tnum text-2xl font-semibold leading-none" style={{ color }}>
        {value}
      </div>
      <div className="mt-1 text-[11px] font-medium text-ink-soft">{label}</div>
      <div className="mt-0.5 text-[11px] text-muted">{unit}</div>
    </div>
  );
}

function RiskBar({ item, maxCount }: { item: DispatchRoiItem; maxCount: number }) {
  const { t } = useTranslation();
  const pct = Math.round((item.count / maxCount) * 100);
  const color = virsColor(item.avgVirs);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="truncate text-[12px] font-medium text-ink-soft">
          {item.name ?? `Cluster ${item.clusterId}`}
        </span>
        <span className="tnum shrink-0 text-[11px] font-semibold" style={{ color }}>
          {item.count}
          <span className="ml-1 font-normal text-faint">{t("virs.common.violShort")}</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--color-surface-2)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
