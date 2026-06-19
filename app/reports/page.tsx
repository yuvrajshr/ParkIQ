"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Radio, Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mapReport, type CitizenReportRow } from "@/lib/citizen/mapReport";
import { REPORT_STATUSES } from "@/lib/citizen/reportStatus";
import type { CitizenReport, ReportStatus } from "@/lib/types";
import ReportCard from "@/components/reports/ReportCard";
import ReportDetail from "@/components/reports/ReportDetail";
import LanguageDropdown from "@/components/LanguageDropdown";
import { useTranslation } from "@/lib/hooks/useTranslation";

const ReportsMap = dynamic(() => import("@/components/reports/ReportsMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface-2" />,
});

type Filter = ReportStatus | "all";

export default function ReportsPage() {
  const { t } = useTranslation();
  const supabaseRef = useRef(createClient());
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Initial load + live subscription.
  useEffect(() => {
    const supabase = supabaseRef.current;
    let active = true;

    supabase
      .from("citizen_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (active && data) setReports((data as CitizenReportRow[]).map(mapReport));
      });

    const channel = supabase
      .channel("citizen_reports_feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "citizen_reports" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const rep = mapReport(payload.new as CitizenReportRow);
          setReports((prev) => (prev.some((p) => p.id === rep.id) ? prev : [rep, ...prev]));
          setToast(t("reports.newReportToast", { road: rep.snappedRoadName ?? "—" }));
        } else if (payload.eventType === "UPDATE") {
          const rep = mapReport(payload.new as CitizenReportRow);
          setReports((prev) => prev.map((p) => (p.id === rep.id ? rep : p)));
        } else if (payload.eventType === "DELETE") {
          const oldId = (payload.old as { id: string }).id;
          setReports((prev) => prev.filter((p) => p.id !== oldId));
        }
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [t]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(id);
  }, [toast]);

  const newCount = useMemo(() => reports.filter((r) => r.status === "new").length, [reports]);
  const filtered = useMemo(
    () => (filter === "all" ? reports : reports.filter((r) => r.status === filter)),
    [reports, filter],
  );
  const selected = useMemo(() => reports.find((r) => r.id === selectedId) ?? null, [reports, selectedId]);

  async function patchStatus(id: string, status: ReportStatus) {
    setBusy(true);
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r))); // optimistic
    await fetch(`/api/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => {});
    setBusy(false);
  }

  async function dispatchWarden(r: CitizenReport) {
    if (!r.snappedRoadId) {
      setToast(t("reports.noRoadForDispatch"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roadId: r.snappedRoadId, simMin: 0 }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error();
      const dispatchId: string | undefined = data.dispatch?.id;
      setReports((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, status: "reviewed", dispatchId: dispatchId ?? x.dispatchId } : x)),
      );
      await fetch(`/api/reports/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "reviewed", dispatchId }),
      }).catch(() => {});
      setToast(t("reports.dispatchedToRoad", { road: r.snappedRoadName ?? "" }));
    } catch {
      setToast(t("reports.dispatchFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="glass sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">{t("reports.backToCommand")}</span>
          </Link>
          <div className="leading-none">
            <div className="eyebrow !text-primary">{t("reports.eyebrow")}</div>
            <h1 className="font-display text-[16px] font-bold tracking-tight text-ink">{t("reports.title")}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 rounded-full bg-heat-low/12 px-2.5 py-1 text-[11.5px] font-semibold text-heat-low">
            <Radio className="live-dot size-3.5" />
            {t("reports.live")}
          </span>
          <LanguageDropdown />
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* Left — filters + list */}
        <aside className="flex min-h-0 flex-col border-r border-line">
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-line px-3 py-2.5">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={t("reports.filterAll")} />
            {REPORT_STATUSES.map((s) => (
              <FilterChip
                key={s}
                active={filter === s}
                onClick={() => setFilter(s)}
                label={t(`reports.status.${s}` as Parameters<typeof t>[0])}
                badge={s === "new" && newCount > 0 ? newCount : undefined}
              />
            ))}
          </div>

          <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto p-2.5">
            {filtered.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-faint">
                  <Inbox className="size-6" />
                </span>
                <p className="text-[13px] leading-relaxed text-muted">{t("reports.empty")}</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {filtered.map((r) => (
                    <motion.li
                      key={r.id}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 480, damping: 38 }}
                    >
                      <ReportCard report={r} selected={r.id === selectedId} onSelect={setSelectedId} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </aside>

        {/* Right — map + detail overlay */}
        <section className="relative min-h-[320px] min-w-0">
          <ReportsMap reports={filtered} selectedId={selectedId} onSelect={setSelectedId} />

          <AnimatePresence>
            {selected && (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute bottom-4 left-4 z-[1100]"
              >
                <ReportDetail
                  report={selected}
                  busy={busy}
                  onStatus={(s) => patchStatus(selected.id, s)}
                  onDispatch={() => dispatchWarden(selected)}
                  onClose={() => setSelectedId(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* Live-arrival toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 460, damping: 34 }}
            className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="flex items-center gap-2.5 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-float ring-1 ring-white/10">
              <Radio className="size-4 text-accent" />
              {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
        active ? "bg-primary text-white" : "bg-surface-2 text-muted hover:text-ink"
      }`}
    >
      {label}
      {badge != null && (
        <span
          className={`tnum rounded-full px-1.5 text-[10px] font-bold ${
            active ? "bg-white/25 text-white" : "bg-accent text-white"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
