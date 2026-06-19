"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Hotspot } from "@/lib/types";
import { heatColor, LEVEL_LABEL } from "@/lib/heat";
import { useTranslation } from "@/lib/hooks/useTranslation";

export type QueueStatus = "none" | "en_route" | "cleared" | "relapsed";

export interface QueueItem {
  h: Hotspot;
  trend: number[];
  status: QueueStatus;
  etaIn?: number;
  recovered?: number;
}

interface Props {
  items: QueueItem[];
  selectedId: string | null;
  onSelect: (roadId: string) => void;
  onDispatch: (roadId: string) => void;
}

export default function PriorityQueue({ items, selectedId, onSelect, onDispatch }: Props) {
  const { t } = useTranslation();

  return (
    <section className="panel flex min-h-0 flex-1 flex-col rounded-2xl">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <div className="eyebrow !text-primary">{t("queue.priorityDispatch")}</div>
          <div className="text-[12px] text-muted">{t("queue.rankedByCIS")}</div>
        </div>
        <span className="tnum rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted ring-1 ring-line">
          {items.length}
        </span>
      </div>

      <div className="scroll-quiet flex-1 overflow-y-auto p-2.5">
        <ul className="flex flex-col gap-2">
          <AnimatePresence>
            {items.map((item, idx) => (
              <QueueCard
                key={item.h.roadId}
                item={item}
                rank={idx + 1}
                selected={item.h.roadId === selectedId}
                onSelect={onSelect}
                onDispatch={onDispatch}
              />
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </section>
  );
}

function QueueCard({
  item,
  rank,
  selected,
  onSelect,
  onDispatch,
}: {
  item: QueueItem;
  rank: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onDispatch: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { h, status } = item;
  const color = heatColor(h.cis);
  const isTop = rank === 1;
  const enterDelay = Math.min(rank - 1, 8) * 0.04;

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
        onClick={() => onSelect(h.roadId)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(h.roadId)}
        className={`elev-hover relative cursor-pointer overflow-hidden rounded-xl border p-3 ${
          selected
            ? "border-primary bg-primary-wash"
            : isTop
              ? "border-line-strong bg-surface"
              : "border-line bg-surface"
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
            <div className="truncate font-display text-[14px] font-semibold leading-tight text-ink">{h.name}</div>
            <div className="truncate text-[11.5px] text-muted">
              {h.nearLandmark ?? h.zone}
              {h.chronic && <span className="ml-1 text-faint">· chronic</span>}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="tnum font-display text-[22px] font-bold leading-none" style={{ color }}>
              {h.cis}
            </div>
            <div className="text-[9.5px] font-semibold uppercase tracking-wide" style={{ color }}>
              {LEVEL_LABEL[h.level]}
            </div>
          </div>
        </div>

        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${h.cis}%`, background: color }}
          />
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="leading-none">
              <div className="tnum text-[13px] font-semibold text-ink">{h.parkedVehicles}</div>
              <div className="text-[9.5px] text-faint">{t("queue.parked")}</div>
            </div>
            <div className="leading-none">
              <div className="tnum text-[13px] font-semibold text-ink">−{h.kmphLost}</div>
              <div className="text-[9.5px] text-faint">km/h</div>
            </div>
          </div>

          <Action item={item} status={status} primary={isTop} onDispatch={onDispatch} />
        </div>
      </div>
    </motion.li>
  );
}

function Action({
  item,
  status,
  primary,
  onDispatch,
}: {
  item: QueueItem;
  status: QueueStatus;
  primary: boolean;
  onDispatch: (id: string) => void;
}) {
  const { t } = useTranslation();

  const send = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDispatch(item.h.roadId);
  };

  if (status === "en_route") {
    return (
      <span className="flex items-center gap-1.5 rounded-lg bg-accent-wash px-2.5 py-1.5 text-[11.5px] font-semibold text-[#9a6a00]">
        <span className="live-dot h-1.5 w-1.5 rounded-full bg-accent" />
        {t("queue.enRoute", { time: item.etaIn ?? 0 })}
      </span>
    );
  }
  if (status === "cleared") {
    return (
      <span className="flex items-center gap-1 rounded-lg bg-[#e6f4ec] px-2.5 py-1.5 text-[11.5px] font-semibold text-heat-low">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2 5 8.5 9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {t("queue.recovered", { recovered: item.recovered ?? 0 })}
      </span>
    );
  }
  if (status === "relapsed") {
    return (
      <button
        onClick={send}
        className="flex items-center gap-1 rounded-lg bg-[#fdeceb] px-2.5 py-1.5 text-[11.5px] font-semibold text-heat-critical hover:bg-[#fbdedc]"
      >
        {t("queue.relapsedResend")}
      </button>
    );
  }
  // Button discipline: only the top-priority card gets the filled blue CTA.
  const base =
    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-[transform,background,color,border-color] active:scale-[0.96]";
  const cls = primary
    ? `${base} bg-primary text-white shadow-[0_6px_14px_-8px_rgba(27,95,176,0.9)] hover:bg-primary-ink`
    : `${base} border border-line-strong bg-surface text-primary hover:border-primary hover:bg-primary hover:text-white`;
  return (
    <button onClick={send} suppressHydrationWarning className={cls}>
      {t("queue.sendWarden")}
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 7h7m0 0L7 4m3 3-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );
}
