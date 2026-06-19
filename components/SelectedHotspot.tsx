"use client";

import type { Hotspot } from "@/lib/types";
import { ROAD_BY_ID } from "@/lib/seed/roads";
import { heatColor, LEVEL_LABEL } from "@/lib/heat";
import { comma, rupees } from "@/lib/format";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { useTranslation } from "@/lib/hooks/useTranslation";

export default function SelectedHotspot({ hotspot }: { hotspot: Hotspot | null }) {
  const { t } = useTranslation();
  // Hook must run unconditionally — call it before the empty-state early return.
  const cisShown = useCountUp(hotspot?.cis ?? 0);

  if (!hotspot) {
    return (
      <section className="panel flex flex-col rounded-2xl p-4">
        <div className="eyebrow">{t("hotspot.whyItMatters")}</div>
        <div className="flex flex-1 flex-col items-start justify-center gap-1 py-2">
          <p className="font-display text-[15px] font-semibold text-ink-soft">{t("hotspot.pickHotspot")}</p>
          <p className="text-[12px] leading-relaxed text-muted">
            {t("hotspot.explanation")}
          </p>
        </div>
      </section>
    );
  }

  const color = heatColor(hotspot.cis);
  const sensitivity = ROAD_BY_ID[hotspot.roadId]?.sensitivityKmphPerVehicle ?? 0;

  return (
    <section className="panel flex flex-col rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow mb-0.5">{t("hotspot.whyItMatters")}</div>
          <div className="truncate font-display text-[16px] font-bold leading-tight text-ink">{hotspot.name}</div>
          <div className="truncate text-[11.5px] text-muted">
            {hotspot.nearLandmark ? `${hotspot.nearLandmark} · ` : ""}
            {hotspot.zone}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="tnum font-display text-[26px] font-bold leading-none" style={{ color }}>
            {Math.round(cisShown)}
          </div>
          <div className="text-[9.5px] font-semibold uppercase tracking-wide" style={{ color }}>
            {LEVEL_LABEL[hotspot.level]}
          </div>
        </div>
      </div>

      {/* The pricing chain */}
      <div className="mt-3 flex items-stretch gap-1.5">
        <Chip top={`${sensitivity}`} unit="km/h / car" label={t("hotspot.thisRoadLoses")} />
        <Op>×</Op>
        <Chip top={`${hotspot.parkedVehicles}`} unit="parked" label={t("hotspot.rightNow")} />
        <Op>=</Op>
        <Chip top={`−${hotspot.kmphLost}`} unit="km/h" label={t("hotspot.speedLost")} accent={color} />
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between text-[11.5px]">
          <span className="text-muted">{t("hotspot.speedNow")}</span>
          <span className="tnum font-semibold text-ink">
            {hotspot.observedKmph} / {hotspot.freeFlowKmph} km/h
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${(hotspot.observedKmph / hotspot.freeFlowKmph) * 100}%`, background: color }}
          />
        </div>
        <div className="flex items-center justify-between pt-1 text-[12px]">
          <span className="text-muted">
            <span className="tnum font-semibold text-ink">{comma(hotspot.vehiclesAffected)}</span> {t("hotspot.vehAffected")}
          </span>
          <span className="font-semibold" style={{ color }}>
            ≈ {rupees(hotspot.rupeesPerMin)}{t("hotspot.perMinLost")}
          </span>
        </div>
      </div>
    </section>
  );
}

function Chip({ top, unit, label, accent }: { top: string; unit: string; label: string; accent?: string }) {
  return (
    <div className="flex-1 rounded-xl bg-surface-2 px-2 py-2 text-center ring-1 ring-line">
      <div className="tnum font-display text-[17px] font-bold leading-none" style={{ color: accent ?? "var(--color-ink)" }}>
        {top}
      </div>
      <div className="text-[9px] font-medium text-faint">{unit}</div>
      <div className="mt-1 text-[9.5px] leading-tight text-muted">{label}</div>
    </div>
  );
}

function Op({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center text-[15px] font-semibold text-faint">{children}</div>;
}
