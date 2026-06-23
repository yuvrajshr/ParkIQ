"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamicImport from "next/dynamic";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Radio, Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mapReport, type CitizenReportRow } from "@/lib/citizen/mapReport";
import { DEMO_REPORTS } from "@/lib/seed/demoReports";
import { dateGroup } from "@/lib/citizen/timeAgo";
import { REPORT_STATUSES, canTransition } from "@/lib/citizen/reportStatus";
import type { CitizenReport, ReportStatus } from "@/lib/types";
import ReportCard from "@/components/reports/ReportCard";
import ReportDetail from "@/components/reports/ReportDetail";
import SettingsMenu from "@/components/SettingsMenu";
import { useTranslation } from "@/lib/hooks/useTranslation";

const ReportsMap = dynamicImport(() => import("@/components/reports/ReportsMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface-2" />,
});

type Filter = ReportStatus;

export default function ReportsPage() {
  const { t } = useTranslation();
  const supabaseRef = useRef(createClient());
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("new");
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
        if (!active) return;
        const live = data ? (data as CitizenReportRow[]).map(mapReport) : [];
        setReports(live.length > 0 ? live : DEMO_REPORTS);
      });

    const channel = supabase
      .channel("citizen_reports_feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "citizen_reports" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const rep = mapReport(payload.new as CitizenReportRow);
          // On first real INSERT, drop demo data and switch to live-only feed.
          setReports((prev) => {
            const withoutDemo = prev.filter((p) => !p.id.startsWith("demo-"));
            return withoutDemo.some((p) => p.id === rep.id) ? withoutDemo : [rep, ...withoutDemo];
          });
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
    () => reports.filter((r) => r.status === filter),
    [reports, filter],
  );
  const selected = useMemo(() => reports.find((r) => r.id === selectedId) ?? null, [reports, selectedId]);

  async function patchStatus(id: string, status: ReportStatus) {
    // Forward-only pipeline: ignore any illegal/stale transition (backward move or a
    // change on an already-terminal report) so the status can never regress.
    const current = reports.find((r) => r.id === id);
    if (!current || !canTransition(current.status, status)) return;
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
          <SettingsMenu />
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* Left — filters + list */}
        <aside className="flex min-h-0 flex-col border-r border-line">
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-line px-3 py-2.5">
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
            ) : filter === "new" ? (
              /* New tab — flat chronological list */
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
            ) : (
              /* Reviewed / Resolved / Dismissed — grouped by date */
              <DateGroupedList reports={filtered} selectedId={selectedId} onSelect={setSelectedId} />
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
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute top-4 left-4 z-[1100]"
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

/** Groups reports by date and renders section headers between groups. */
function DateGroupedList({
  reports,
  selectedId,
  onSelect,
}: {
  reports: CitizenReport[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();

  // Build ordered groups. Reports are already sorted by createdAt desc from the query.
  const groups = useMemo(() => {
    const map = new Map<string, CitizenReport[]>();
    for (const r of reports) {
      const g = dateGroup(r.createdAt);
      const label = g.key ? g.key : g.label!;
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(r);
    }
    return Array.from(map.entries());
  }, [reports]);

  return (
    <div className="flex flex-col gap-3">
      {groups.map(([groupKey, items]) => {
        // If groupKey is an i18n key (starts with "reports."), translate it; otherwise use as-is.
        const heading = groupKey.startsWith("reports.")
          ? t(groupKey as Parameters<typeof t>[0])
          : groupKey;

        return (
          <section key={groupKey}>
            <div className="sticky top-0 z-10 flex items-center gap-2 px-1 pb-1.5 pt-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {heading}
              </span>
              <span className="tnum text-[10px] text-faint">{items.length}</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <ul className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {items.map((r) => (
                  <motion.li
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 480, damping: 38 }}
                  >
                    <ReportCard report={r} selected={r.id === selectedId} onSelect={onSelect} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </section>
        );
      })}
    </div>
  );
}
