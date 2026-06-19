"use client";

import type { Hotspot, Warden } from "@/lib/types";
import WardenStrip from "./WardenStrip";
import { useTranslation } from "@/lib/hooks/useTranslation";

interface Props {
  kpis: { kmph: number; parked: number; rupees: number };
  allHotspots: Hotspot[];
  wardens: Warden[];
  clearedNow: number;
}

export default function LeftSidebar({ kpis, allHotspots, wardens, clearedNow }: Props) {
  const { t } = useTranslation();

  const deployed = wardens.filter((w) => w.status === "en_route" || w.status === "on_site").length;

  const zoneMap = new Map<string, number>();
  for (const h of allHotspots) {
    zoneMap.set(h.zone, (zoneMap.get(h.zone) ?? 0) + h.parkedVehicles);
  }
  const zones = Array.from(zoneMap.entries()).sort((a, b) => b[1] - a[1]);
  const maxVehicles = Math.max(1, ...zones.map(([, v]) => v));

  return (
    <>
      {/* KPI Stats */}
      <div className="panel rounded-2xl p-5 shrink-0">
        <div className="eyebrow mb-4">{t("sidebar.liveStatus")}</div>
        <div className="grid grid-cols-2 gap-3">
          <MetricBlock
            label={t("sidebar.activeViolations")}
            value={kpis.parked}
            unit={t("sidebar.vehicles")}
            color="var(--color-heat-high)"
          />
          <MetricBlock
            label={t("sidebar.speedLost")}
            value={kpis.kmph.toFixed(1)}
            unit={t("sidebar.kmhTotal")}
            color="var(--color-accent)"
          />
          <MetricBlock
            label={t("sidebar.wardensDeployed")}
            value={deployed}
            unit={t("sidebar.onDuty")}
            color="var(--color-heat-low)"
          />
          <MetricBlock
            label={t("sidebar.zonesCleared")}
            value={clearedNow}
            unit={t("sidebar.thisSession")}
            color="var(--color-primary)"
          />
        </div>
      </div>

      {/* Zone Breakdown */}
      <div className="panel rounded-2xl p-5 shrink-0">
        <div className="eyebrow mb-4">{t("sidebar.zoneBreakdown")}</div>
        {zones.length === 0 ? (
          <p className="text-xs text-muted">{t("sidebar.noViolations")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {zones.map(([zone, count]) => (
              <ZoneBar key={zone} zone={zone} count={count} max={maxVehicles} vehicleLabel={t("sidebar.vehicles")} />
            ))}
          </div>
        )}
      </div>

      <WardenStrip wardens={wardens} />
    </>
  );
}

function MetricBlock({
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

function ZoneBar({
  zone,
  count,
  max,
  vehicleLabel,
}: {
  zone: string;
  count: number;
  max: number;
  vehicleLabel: string;
}) {
  const pct = Math.round((count / max) * 100);
  const barColor =
    pct > 70
      ? "var(--color-heat-high)"
      : pct > 40
        ? "var(--color-accent)"
        : "var(--color-heat-low)";
  return (
    <div>
      <div className="mb-1.5 flex justify-between">
        <span className="text-[12px] font-medium text-ink-soft">{zone}</span>
        <span className="tnum text-[11px] text-muted">{count} {vehicleLabel}</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--color-surface-2)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}
