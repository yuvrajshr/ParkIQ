"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { LayoutDashboard, Plus, LogOut, Camera, FileText } from "lucide-react";
import SimClock from "./SimClock";
import SettingsMenu from "./SettingsMenu";
import ModeToggle from "./ModeToggle";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { useNewReportsCount } from "@/lib/hooks/useNewReportsCount";
import { useModeStore } from "@/store/useModeStore";

interface Props {
  aiOpen: boolean;
  onAiToggle: () => void;
}

export default function DashboardHeader({ aiOpen, onAiToggle }: Props) {
  const [active, setActive] = useState("command");
  const [loggingOut, setLoggingOut] = useState(false);
  const { t } = useTranslation();
  const newReports = useNewReportsCount();
  const mode = useModeStore((s) => s.mode);

  const NAV_ITEMS = [
    { id: "command", label: t("nav.command") },
    { id: "map", label: t("nav.liveMap") },
    { id: "forecast", label: t("nav.forecast") },
    { id: "review", label: t("nav.afterAction") },
  ];

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-white/10 dark:border-white/10 border-line">
      {/* Top row */}
      <div
        className="flex px-8 py-4 justify-between items-center"
        style={{
          background: "var(--hdr-top-bg)",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        }}
      >
        {/* Left: logo + title */}
        <div className="flex items-center gap-4">
          <div
            className="size-11 rounded-2xl flex justify-center items-center flex-shrink-0"
            style={{
              background: "var(--hdr-accent-bg)",
              color: "var(--hdr-accent-fg)",
              boxShadow: "0 8px 20px -6px rgba(0,0,0,0.3)",
            }}
          >
            <LayoutDashboard className="size-5" />
          </div>
          <div className="space-y-0.5">
            <div
              className="font-medium uppercase text-xs leading-4 tracking-[3.84px]"
              style={{ color: "var(--hdr-eyebrow)" }}
            >
              {t("header.opsControl")}
            </div>
            <div
              className="font-semibold text-2xl leading-8 tracking-tight"
              style={{ color: "var(--hdr-title)" }}
            >
              {t("header.title")}
            </div>
          </div>
        </div>

        {/* Right: sim controls → mode toggle → settings → ai → dispatch → logout */}
        <div className="flex items-center gap-3">
          <AnimatePresence initial={false}>
            {mode === "sim" && (
              <motion.div
                key="sim-clock"
                initial={{ width: 0, opacity: 0, x: 16 }}
                animate={{ width: "auto", opacity: 1, x: 0 }}
                exit={{ width: 0, opacity: 0, x: 16 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                style={{ overflow: "hidden" }}
                className="flex items-center"
              >
                <SimClock />
              </motion.div>
            )}
          </AnimatePresence>

          <div id="tour-mode-toggle"><ModeToggle /></div>

          <SettingsMenu variant="header" />

          <button
            id="tour-ai-button"
            onClick={onAiToggle}
            aria-label={aiOpen ? t("ai.closeInsights") : t("ai.openInsights")}
            className="flex items-center gap-2 rounded-full px-4 h-9 font-medium text-sm transition-colors"
            style={{
              background: "var(--hdr-ai-bg)",
              backdropFilter: "blur(14px) saturate(1.6)",
              WebkitBackdropFilter: "blur(14px) saturate(1.6)",
              border: "1px solid var(--hdr-ai-border)",
              color: "var(--hdr-ai-fg)",
              boxShadow: "var(--hdr-ai-shadow)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
              <line x1="11" y1="1" x2="11" y2="4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <circle cx="11" cy="1" r="1" fill="currentColor"/>
              <rect x="3" y="4" width="16" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.6"/>
              <circle cx="8" cy="10.5" r="1.8" fill="currentColor"/>
              <circle cx="14" cy="10.5" r="1.8" fill="currentColor"/>
              <path d="M8 14h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            {t("ai.title")}
          </button>

          <button
            className="flex items-center gap-2 rounded-full px-5 h-9 font-medium text-sm transition-colors"
            style={{
              background: "var(--hdr-accent-bg)",
              color: "var(--hdr-accent-fg)",
            }}
          >
            <Plus className="size-4" />
            {t("header.newDispatch")}
          </button>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title={t("header.signOut")}
            aria-label={t("header.signOut")}
            className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors disabled:opacity-50"
            style={{
              background: "var(--hdr-btn-bg)",
              color: "var(--hdr-btn-fg)",
              border: "1px solid var(--hdr-btn-border)",
            }}
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>

      {/* Nav tabs row */}
      <div
        className="px-8 py-3 border-t"
        style={{
          background: "var(--hdr-nav-bg)",
          borderColor: "var(--hdr-nav-border)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <div className="flex items-center gap-2 text-sm leading-5">
          {NAV_ITEMS.map(({ id, label }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                onClick={() => setActive(id)}
                className="rounded-full px-4 py-2 font-medium transition-colors"
                style={
                  isActive
                    ? {
                        background: "var(--hdr-accent-bg)",
                        color: "var(--hdr-accent-fg)",
                      }
                    : {
                        color: "var(--hdr-nav-inactive)",
                      }
                }
              >
                {label}
              </button>
            );
          })}

          {/* On-demand PDF intelligence report builder. */}
          <Link
            id="tour-report-builder-link"
            href="/report-builder"
            className="nav-report-pill ml-auto flex items-center gap-2 rounded-full px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <FileText className="size-4" />
            {t("nav.generateReport")}
          </Link>

          {/* Real destination — the public reporting channel, with a live new-count badge. */}
          <Link
            id="tour-reports-link"
            href="/reports"
            className="nav-reports-pill flex items-center gap-2 rounded-full px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Camera className="size-4" />
            {t("nav.reports")}
            {newReports > 0 && (
              <span className="tnum flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">
                {newReports}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
