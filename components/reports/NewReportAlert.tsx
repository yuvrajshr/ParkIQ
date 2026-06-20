"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mapReport, type CitizenReportRow } from "@/lib/citizen/mapReport";
import { relativeTime } from "@/lib/citizen/timeAgo";
import { useTranslation } from "@/lib/hooks/useTranslation";
import type { CitizenReport } from "@/lib/types";
import AiVerdictChip from "./AiVerdictChip";

const DISMISS_MS = 6000;
const MAX_STACK = 4; // newest on top; older alerts drop off so the corner never floods

/** Floating top-right alerts when a citizen violation report lands. Mirrors the Realtime wiring
 *  of useNewReportsCount; the header badge owns the running count, this gives the commander an
 *  actionable pop-up with a jump straight to the report. */
export default function NewReportAlert() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<CitizenReport[]>([]);

  const dismiss = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("reports_alert")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "citizen_reports" },
        (payload) => {
          const rep = mapReport(payload.new as CitizenReportRow);
          setAlerts((prev) =>
            prev.some((p) => p.id === rep.id) ? prev : [rep, ...prev].slice(0, MAX_STACK),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed right-5 top-[120px] z-[1200] flex w-[340px] flex-col gap-2.5">
      <AnimatePresence initial={false}>
        {alerts.map((r) => (
          <AlertCard key={r.id} report={r} t={t} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function AlertCard({
  report: r,
  t,
  onDismiss,
}: {
  report: CitizenReport;
  t: ReturnType<typeof useTranslation>["t"];
  onDismiss: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const ago = relativeTime(r.createdAt);
  const typeLabel = t(`report.type.${r.violationType}` as Parameters<typeof t>[0]);

  // Self-dismiss after the countdown. onDismiss is stable, r.id is stable → timer is set once.
  useEffect(() => {
    const id = setTimeout(() => onDismiss(r.id), DISMISS_MS);
    return () => clearTimeout(id);
  }, [onDismiss, r.id]);

  return (
    <motion.div
      layout
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className="glass pointer-events-auto relative overflow-hidden rounded-2xl shadow-float"
    >
      <button
        onClick={() => onDismiss(r.id)}
        aria-label={t("ai.close")}
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-faint transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
      >
        <X className="size-4" />
      </button>

      <div className="p-3.5">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: "var(--color-accent)" }} />
          <span className="eyebrow" style={{ color: "var(--color-accent)" }}>
            {t("reports.newViolationAlert")}
          </span>
        </div>

        <div className="flex items-start gap-3">
          <div className="relative h-14 w-14 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={r.photoUrl}
              alt={typeLabel}
              className="h-14 w-14 rounded-xl object-cover ring-1 ring-line"
            />
            <span className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-t from-black/30" />
          </div>
          <div className="min-w-0 flex-1 pr-5">
            <div className="truncate font-display text-[14px] font-semibold leading-tight text-ink">
              {typeLabel}
            </div>
            <div className="mt-0.5 truncate text-[12px] text-muted">
              {r.snappedRoadName ? t("reports.nearRoad", { road: r.snappedRoadName }) : t("reports.unmatched")}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="tnum text-[11px] text-faint">
                {t(ago.key as Parameters<typeof t>[0], { n: ago.n })}
              </span>
              <AiVerdictChip verdict={r.aiVerdict} confidence={r.aiConfidence} />
            </div>
          </div>
        </div>

        <Link
          href="/reports"
          onClick={() => onDismiss(r.id)}
          className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12.5px] font-semibold text-white transition-[transform,background-color] hover:bg-primary-ink active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary"
        >
          {t("reports.viewReport")}
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {/* Signature: a depleting amber line — the 6s "time to act" countdown made visible. */}
      {!reduce && (
        <motion.span
          className="absolute bottom-0 left-0 h-[3px] w-full"
          style={{ transformOrigin: "left", background: "var(--color-accent)" }}
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: DISMISS_MS / 1000, ease: "linear" }}
        />
      )}
    </motion.div>
  );
}
