"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { DispatchRoiItem } from "@/lib/types";
import { virsColor, virsBand } from "@/lib/virs/heat";
import { useTranslation } from "@/lib/hooks/useTranslation";

// VIRS-mode replacement for the simulation's PriorityQueue: clusters ranked by Dispatch-ROI.
// (ROI is interim — avg_virs x log1p(count) x peak-weight — until Prophet/travel-time are wired.)
interface Props {
  items: DispatchRoiItem[];
  selectedClusterId: number | null;
  onSelect: (clusterId: number) => void;
}

export default function DispatchRoiQueue({ items, selectedClusterId, onSelect }: Props) {
  const { t } = useTranslation();
  const maxRoi = Math.max(0.0001, ...items.map((i) => i.roi));

  return (
    <section className="panel flex min-h-0 flex-1 flex-col rounded-2xl">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <div className="eyebrow !text-primary">{t("virs.queue.title")}</div>
          <div className="text-[12px] text-muted">{t("virs.queue.sub")}</div>
        </div>
        <span className="tnum rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted ring-1 ring-line">
          {items.length}
        </span>
      </div>

      <div className="scroll-quiet flex-1 overflow-y-auto p-2.5">
        <ul className="flex flex-col gap-2">
          <AnimatePresence>
            {items.map((item, idx) => (
              <RoiCard
                key={item.clusterId}
                item={item}
                rank={idx + 1}
                maxRoi={maxRoi}
                selected={item.clusterId === selectedClusterId}
                onSelect={onSelect}
              />
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </section>
  );
}

function RoiCard({
  item,
  rank,
  maxRoi,
  selected,
  onSelect,
}: {
  item: DispatchRoiItem;
  rank: number;
  maxRoi: number;
  selected: boolean;
  onSelect: (id: number) => void;
}) {
  const { t } = useTranslation();
  const color = virsColor(item.avgVirs);
  const isTop = rank === 1;
  const enterDelay = Math.min(rank - 1, 8) * 0.04;
  const roiPct = Math.round((item.roi / maxRoi) * 100);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{
        layout: { type: "spring", stiffness: 520, damping: 42 },
        opacity: { duration: 0.3, delay: enterDelay },
        y: { type: "spring", stiffness: 420, damping: 34, delay: enterDelay },
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(item.clusterId)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(item.clusterId)}
        className={`elev-hover relative cursor-pointer overflow-hidden rounded-xl border p-3 ${
          selected ? "border-primary bg-primary-wash" : isTop ? "border-line-strong bg-surface" : "border-line bg-surface"
        }`}
      >
        {isTop && (
          <span
            className="absolute inset-y-0 left-0 w-[3px]"
            style={{ background: `linear-gradient(to bottom, ${color}, ${color}55)` }}
          />
        )}
        <div className="flex items-start gap-2.5">
          <span
            className="tnum mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white"
            style={{ background: color }}
          >
            {rank}
          </span>

          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[14px] font-semibold leading-tight text-ink">
              {item.name ?? `Cluster ${item.clusterId}`}
            </div>
            <div className="truncate text-[11.5px] text-muted">
              {t("virs.queue.meta", {
                count: item.count,
                vehicle: item.topVehicle ?? t("virs.queue.mixed"),
                pct: Math.round(item.peakShare * 100),
              })}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="tnum font-display text-[22px] font-bold leading-none" style={{ color }}>
              {item.severityIndex}
            </div>
            <div className="text-[9.5px] font-semibold uppercase tracking-wide" style={{ color }}>
              {t(`virs.band.${virsBand(item.avgVirs)}`)}
            </div>
          </div>
        </div>

        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${roiPct}%`, background: color }} />
        </div>

        <div className="mt-2 flex items-center justify-between text-[11.5px]">
          <span className="text-muted">
            ROI <span className="tnum font-mono font-semibold text-ink">{item.roi.toFixed(2)}</span>
          </span>
          <span className="text-[10px] uppercase tracking-wide text-faint">
            {item.roiBasis === "interim" ? t("virs.queue.interim") : item.roiBasis}
          </span>
        </div>
      </div>
    </motion.li>
  );
}
