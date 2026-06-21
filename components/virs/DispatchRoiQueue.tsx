"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, MapPin } from "lucide-react";
import type { DispatchRoiItem } from "@/lib/types";
import { virsBandSI } from "@/lib/virs/heat";
import { useTranslation } from "@/lib/hooks/useTranslation";

type Band = "critical" | "high" | "mid" | "low";
type Zone = "All" | "CBD" | "North" | "South" | "East" | "West";

interface Props {
  items: DispatchRoiItem[];
  selectedClusterId: number | null;
  onSelect: (clusterId: number) => void;
}

const ZONE_LABELS: Record<Zone, string> = {
  All:   "All Zones",
  CBD:   "Central Bengaluru",
  North: "North Bengaluru",
  South: "South Bengaluru",
  East:  "East Bengaluru",
  West:  "West Bengaluru",
};

const ZONES: Zone[] = ["All", "CBD", "North", "South", "East", "West"];

function bengaluruZone(lat: number, lng: number): Exclude<Zone, "All"> {
  if (lat > 13.0)  return "North";
  if (lat < 12.93) return "South";
  if (lng > 77.65) return "East";
  if (lng < 77.55) return "West";
  return "CBD";
}

const BAND_LABEL: Record<Band, string> = { critical: "Critical", high: "High", mid: "Medium", low: "Low" };
const BAND_COLOR: Record<Band, string> = { critical: "#b3261e", high: "#e4572e", mid: "#d4900a", low: "#2e9e6b" };
const BAND_BG:    Record<Band, string> = {
  critical: "rgba(179,38,30,0.14)",
  high:     "rgba(228,87,46,0.14)",
  mid:      "rgba(212,144,10,0.13)",
  low:      "rgba(46,158,107,0.13)",
};
const BAND_PRIORITY: Record<Band, number> = { critical: 0, high: 1, mid: 2, low: 3 };

export default function DispatchRoiQueue({ items, selectedClusterId, onSelect }: Props) {
  const { t } = useTranslation();
  const [activeZone, setActiveZone] = useState<Zone>("All");
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Annotate each item with its zone, then filter + sort
  const filtered = useMemo(() => {
    const annotated = items.map((item) => ({
      ...item,
      zone: bengaluruZone(item.lat, item.lng),
    }));

    const visible = activeZone === "All"
      ? annotated
      : annotated.filter((i) => i.zone === activeZone);

    return visible.sort((a, b) => {
      const pa = BAND_PRIORITY[virsBandSI(a.severityIndex)];
      const pb = BAND_PRIORITY[virsBandSI(b.severityIndex)];
      return pa !== pb ? pa - pb : b.severityIndex - a.severityIndex;
    });
  }, [items, activeZone]);

  const maxRoi = Math.max(0.0001, ...filtered.map((i) => i.roi));

  // Per-zone counts for the dropdown options
  const zoneCounts = useMemo(() => {
    const counts: Partial<Record<Zone, number>> = { All: items.length };
    for (const item of items) {
      const z = bengaluruZone(item.lat, item.lng);
      counts[z] = (counts[z] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  return (
    <section className="panel flex min-h-0 flex-1 flex-col rounded-2xl">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="eyebrow !text-primary">{t("virs.queue.title")}</div>
          <div className="text-[12px] text-muted">{t("virs.queue.sub")}</div>
        </div>

        {/* Zone dropdown pill */}
        <div ref={dropRef} className="relative">
          <button
            onClick={() => setDropOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-ink transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <MapPin className="size-3 text-primary" />
            <span className="max-w-[110px] truncate">{ZONE_LABELS[activeZone]}</span>
            <ChevronDown
              className="size-3 text-muted transition-transform"
              style={{ transform: dropOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>

          <AnimatePresence>
            {dropOpen && (
              <motion.ul
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
                className="absolute right-0 top-full z-50 mt-1.5 w-48 overflow-hidden rounded-xl border border-line bg-surface shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
              >
                {ZONES.map((zone) => (
                  <li key={zone}>
                    <button
                      onClick={() => { setActiveZone(zone); setDropOpen(false); }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-[12.5px] transition-colors ${
                        activeZone === zone
                          ? "bg-primary/10 font-semibold text-primary"
                          : "text-ink hover:bg-surface-2"
                      }`}
                    >
                      <span>{ZONE_LABELS[zone]}</span>
                      <span className="tnum text-[11px] text-faint">{zoneCounts[zone] ?? 0}</span>
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        <span className="tnum rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted ring-1 ring-line">
          {filtered.length}
        </span>
      </div>

      {/* Cluster list */}
      <div className="scroll-quiet flex-1 overflow-y-auto p-2.5">
        <ul className="flex flex-col gap-1.5">
          <AnimatePresence mode="popLayout">
            {filtered.map((item) => (
              <motion.li
                key={item.clusterId}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              >
                <RoiCard
                  item={item}
                  maxRoi={maxRoi}
                  selected={item.clusterId === selectedClusterId}
                  onSelect={onSelect}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </section>
  );
}

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
        <span
          className="mt-px shrink-0 rounded-md px-1.5 py-[3px] text-[9.5px] font-bold uppercase tracking-wider"
          style={{ color, background: BAND_BG[band] }}
        >
          {BAND_LABEL[band]}
        </span>

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

        <div className="shrink-0 text-right">
          <div className="tnum font-display text-[20px] font-bold leading-none" style={{ color }}>
            {item.severityIndex}
          </div>
          <div className="tnum text-[9.5px] text-faint">
            ROI <span className="font-mono font-semibold text-muted">{item.roi.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${roiPct}%`, background: color }}
        />
      </div>
    </div>
  );
}
