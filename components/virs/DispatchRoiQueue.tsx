"use client";

import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { DispatchRoiItem } from "@/lib/types";
import { virsBandSI } from "@/lib/virs/heat";
import { useTranslation } from "@/lib/hooks/useTranslation";

type Band = "critical" | "high" | "mid" | "low";
type Zone = "CBD" | "North" | "South" | "East" | "West";

interface Props {
  items: DispatchRoiItem[];
  selectedClusterId: number | null;
  onSelect: (clusterId: number) => void;
}

// ── Bengaluru zone boundaries (lat/lng) ───────────────────────────────────────
// Assigned in order: North → South → East → West → CBD (catch-all).

const ZONE_LABELS: Record<Zone, string> = {
  CBD: "Central Bengaluru",
  North: "North Bengaluru",
  South: "South Bengaluru",
  East: "East Bengaluru",
  West: "West Bengaluru",
};

function bengaluruZone(lat: number, lng: number): Zone {
  if (lat > 13.0) return "North";
  if (lat < 12.93) return "South";
  if (lng > 77.65) return "East";
  if (lng < 77.55) return "West";
  return "CBD";
}

// ── Severity tier config ──────────────────────────────────────────────────────

const BAND_PRIORITY: Record<Band, number> = { critical: 0, high: 1, mid: 2, low: 3 };

const BAND_LABEL: Record<Band, string> = {
  critical: "Critical",
  high: "High",
  mid: "Medium",
  low: "Low",
};

const BAND_COLOR: Record<Band, string> = {
  critical: "#b3261e",
  high: "#e4572e",
  mid: "#d4900a",
  low: "#2e9e6b",
};

const BAND_BG: Record<Band, string> = {
  critical: "rgba(179,38,30,0.14)",
  high: "rgba(228,87,46,0.14)",
  mid: "rgba(212,144,10,0.13)",
  low: "rgba(46,158,107,0.13)",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DispatchRoiQueue({ items, selectedClusterId, onSelect }: Props) {
  const { t } = useTranslation();
  const maxRoi = Math.max(0.0001, ...items.map((i) => i.roi));

  // Group by zone; sort each zone by band → severityIndex desc
  const grouped = useMemo(() => {
    const map = new Map<Zone, DispatchRoiItem[]>();
    (["CBD", "North", "South", "East", "West"] as Zone[]).forEach((z) => map.set(z, []));

    for (const item of items) {
      map.get(bengaluruZone(item.lat, item.lng))!.push(item);
    }

    for (const zoneItems of map.values()) {
      zoneItems.sort((a, b) => {
        const pa = BAND_PRIORITY[virsBandSI(a.severityIndex)];
        const pb = BAND_PRIORITY[virsBandSI(b.severityIndex)];
        return pa !== pb ? pa - pb : b.severityIndex - a.severityIndex;
      });
    }

    // Only return populated zones; order by highest severity item first
    return (["CBD", "North", "South", "East", "West"] as Zone[])
      .map((zone) => ({ zone, items: map.get(zone)! }))
      .filter(({ items: zi }) => zi.length > 0)
      .sort((a, b) => (b.items[0]?.severityIndex ?? 0) - (a.items[0]?.severityIndex ?? 0));
  }, [items]);

  // All zones open by default; user can collapse
  const [collapsed, setCollapsed] = useState<Set<Zone>>(new Set());

  function toggleZone(zone: Zone) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(zone) ? next.delete(zone) : next.add(zone);
      return next;
    });
  }

  return (
    <section className="panel flex min-h-0 flex-1 flex-col rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <div className="eyebrow !text-primary">{t("virs.queue.title")}</div>
          <div className="text-[12px] text-muted">{t("virs.queue.sub")}</div>
        </div>
        <span className="tnum rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted ring-1 ring-line">
          {items.length}
        </span>
      </div>

      {/* Zone accordion */}
      <div className="scroll-quiet flex-1 overflow-y-auto p-2.5">
        <div className="flex flex-col gap-2">
          {grouped.map(({ zone, items: zoneItems }) => (
            <ZoneSection
              key={zone}
              zone={zone}
              items={zoneItems}
              open={!collapsed.has(zone)}
              onToggle={() => toggleZone(zone)}
              maxRoi={maxRoi}
              selectedClusterId={selectedClusterId}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Zone section ──────────────────────────────────────────────────────────────

function ZoneSection({
  zone,
  items,
  open,
  onToggle,
  maxRoi,
  selectedClusterId,
  onSelect,
}: {
  zone: Zone;
  items: DispatchRoiItem[];
  open: boolean;
  onToggle: () => void;
  maxRoi: number;
  selectedClusterId: number | null;
  onSelect: (id: number) => void;
}) {
  // Count per severity band for the distribution dots
  const bandCounts = useMemo(() => {
    const acc: Partial<Record<Band, number>> = {};
    for (const item of items) {
      const b = virsBandSI(item.severityIndex);
      acc[b] = (acc[b] ?? 0) + 1;
    }
    return acc;
  }, [items]);

  const shownBands = (["critical", "high", "mid", "low"] as Band[]).filter((b) => bandCounts[b]);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {/* Zone header / toggle */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {open ? (
          <ChevronDown className="size-3.5 shrink-0 text-muted" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-muted" />
        )}

        <span className="flex-1 truncate font-display text-[13px] font-semibold text-ink">
          {ZONE_LABELS[zone]}
        </span>

        {/* Severity distribution dots */}
        <span className="flex items-center gap-2">
          {shownBands.map((band) => (
            <span key={band} className="flex items-center gap-0.5">
              <span
                className="inline-block size-[6px] rounded-full"
                style={{ background: BAND_COLOR[band] }}
              />
              <span className="tnum text-[10px] font-semibold" style={{ color: BAND_COLOR[band] }}>
                {bandCounts[band]}
              </span>
            </span>
          ))}
        </span>

        <span className="tnum ml-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-faint ring-1 ring-line">
          {items.length}
        </span>
      </button>

      {/* Cluster cards */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="zone-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="flex flex-col gap-1.5 border-t border-line p-2">
              {items.map((item) => (
                <RoiCard
                  key={item.clusterId}
                  item={item}
                  maxRoi={maxRoi}
                  selected={item.clusterId === selectedClusterId}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Cluster card ──────────────────────────────────────────────────────────────

function RoiCard({
  item,
  maxRoi,
  selected,
  onSelect,
}: {
  item: DispatchRoiItem;
  maxRoi: number;
  selected: boolean;
  onSelect: (id: number) => void;
}) {
  const { t } = useTranslation();
  const band = virsBandSI(item.severityIndex);
  const color = BAND_COLOR[band];
  const roiPct = Math.round((item.roi / maxRoi) * 100);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item.clusterId)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(item.clusterId)}
      className={`elev-hover relative cursor-pointer overflow-hidden rounded-xl border p-2.5 transition-colors ${
        selected ? "border-primary bg-primary-wash" : "border-line bg-surface hover:bg-surface-2"
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Severity badge */}
        <span
          className="mt-px shrink-0 rounded-md px-1.5 py-[3px] text-[9.5px] font-bold uppercase tracking-wider"
          style={{ color, background: BAND_BG[band] }}
        >
          {BAND_LABEL[band]}
        </span>

        {/* Road name + meta */}
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[13px] font-semibold leading-tight text-ink">
            {item.name ?? `Cluster ${item.clusterId}`}
          </div>
          <div className="truncate text-[11px] text-muted">
            {t("virs.queue.meta", {
              count: item.count,
              vehicle: item.topVehicle ?? t("virs.queue.mixed"),
              pct: Math.round(item.peakShare * 100),
            })}
          </div>
        </div>

        {/* Score + ROI */}
        <div className="shrink-0 text-right">
          <div className="tnum font-display text-[20px] font-bold leading-none" style={{ color }}>
            {item.severityIndex}
          </div>
          <div className="tnum text-[9.5px] text-faint">
            ROI <span className="font-mono font-semibold text-muted">{item.roi.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* ROI bar */}
      <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${roiPct}%`, background: color }}
        />
      </div>
    </div>
  );
}
