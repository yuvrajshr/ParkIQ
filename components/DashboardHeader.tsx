"use client";

import { useState, useSyncExternalStore } from "react";
import { LayoutDashboard, Plus, Moon, Sun, LogOut } from "lucide-react";
import SimClock from "./SimClock";
import LanguageDropdown from "./LanguageDropdown";
import { useTranslation } from "@/lib/hooks/useTranslation";

interface Props {
  aiOpen: boolean;
  onAiToggle: () => void;
}

// Dark mode lives in the DOM (`.dark` on <html>), set pre-paint and toggled
// imperatively. Subscribe to it rather than mirroring it into an effect so the
// aria-labels stay correct without a setState-in-effect cascade.
function subscribeDark(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}
const getDarkSnapshot = () => document.documentElement.classList.contains("dark");
const getDarkServerSnapshot = () => false;

export default function DashboardHeader({ aiOpen, onAiToggle }: Props) {
  const [active, setActive] = useState("command");
  const isDark = useSyncExternalStore(subscribeDark, getDarkSnapshot, getDarkServerSnapshot);
  const [loggingOut, setLoggingOut] = useState(false);
  const { t } = useTranslation();

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

  function toggleDark() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("parkiq-dark", String(next));
    } catch {}
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

        {/* Right: sim controls + language + dark toggle + dispatch + logout */}
        <div className="flex items-center gap-3">
          <SimClock />

          <LanguageDropdown isDark={isDark} />

          <button
            onClick={toggleDark}
            role="switch"
            aria-checked={isDark}
            title={isDark ? t("header.toLightMode") : t("header.toDarkMode")}
            aria-label={isDark ? t("header.toLightMode") : t("header.toDarkMode")}
            className="relative shrink-0 rounded-full"
            style={{
              width: 72,
              height: 36,
              background: "var(--hdr-btn-bg)",
              border: "1px solid var(--hdr-btn-border)",
            }}
          >
            {/* Sun — left zone; visible when in dark mode (knob is on right) */}
            <Sun
              className="absolute top-1/2 -translate-y-1/2 size-3.5"
              style={{ left: 11, color: "var(--color-accent)", zIndex: 0 }}
            />
            {/* Moon — right zone; visible when in light mode (knob is on left) */}
            <Moon
              className="absolute top-1/2 -translate-y-1/2 size-3.5"
              style={{ right: 11, color: "var(--color-primary)", zIndex: 0 }}
            />
            {/* Sliding knob — covers the active-mode icon, reveals the other */}
            <span
              className="absolute top-1/2 rounded-full"
              style={{
                width: 28,
                height: 28,
                left: 4,
                zIndex: 10,
                background: "#ffffff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)",
                transform: `translateY(-50%) translateX(${isDark ? 36 : 0}px)`,
                transition: "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            />
          </button>

          <button
            onClick={onAiToggle}
            aria-label={aiOpen ? t("ai.closeInsights") : t("ai.openInsights")}
            className="flex items-center gap-2 rounded-full px-4 h-9 font-medium text-sm transition-all"
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
        </div>
      </div>
    </header>
  );
}
