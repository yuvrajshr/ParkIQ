"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Sun, Moon } from "lucide-react";
import { useLangStore, type Lang } from "@/lib/store/langStore";

const LANGS: { value: Lang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "kn", label: "ಕನ್ನಡ" },
];

function subscribeDark(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}
const getDark = () => document.documentElement.classList.contains("dark");
const getDarkSsr = () => false;

interface Props {
  /** "header" uses the DashboardHeader's --hdr-* token set for the trigger button. */
  variant?: "header" | "page";
}

export default function SettingsMenu({ variant = "page" }: Props) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const isDark = useSyncExternalStore(subscribeDark, getDark, getDarkSsr);

  function toggleDark() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("parkiq-dark", String(next));
    } catch {}
  }

  // Position the portal dropdown anchored to the button's bottom-right corner.
  function reposition() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: r.bottom + 8,
      right: window.innerWidth - r.right,
      zIndex: 99999,
    });
  }

  useEffect(() => {
    if (!open) return;
    reposition();

    function onDown(e: MouseEvent) {
      if (
        btnRef.current?.contains(e.target as Node) ||
        dropRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const btnBg = variant === "header" ? "var(--hdr-btn-bg)" : "var(--color-surface-2)";
  const btnBorder = variant === "header" ? "var(--hdr-btn-border)" : "var(--color-line-strong)";
  const btnFg = variant === "header" ? "var(--hdr-btn-fg)" : "var(--color-ink)";

  const dropdown = open ? (
    <div
      ref={dropRef}
      role="dialog"
      aria-label="Settings"
      className="w-52 rounded-xl p-3"
      style={{
        ...dropdownStyle,
        background: "var(--color-surface)",
        border: "1px solid var(--color-line-strong)",
        boxShadow: "0 8px 24px -4px rgba(0,0,0,0.22), 0 2px 8px -2px rgba(0,0,0,0.12)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Language */}
      <div
        className="mb-1.5 px-0.5 text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "var(--color-faint)" }}
      >
        Language
      </div>
      <div className="flex gap-1">
        {LANGS.map(({ value, label }) => {
          const active = lang === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setLang(value)}
              className="flex-1 rounded-lg py-1.5 text-[11.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary"
              style={{
                background: active
                  ? "color-mix(in srgb, var(--color-primary) 14%, var(--color-surface))"
                  : "var(--color-surface-2)",
                color: active ? "var(--color-primary)" : "var(--color-ink-soft)",
                border: active
                  ? "1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)"
                  : "1px solid var(--color-line)",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="my-2.5" style={{ borderTop: "1px solid var(--color-line)" }} />

      {/* Appearance */}
      <div
        className="mb-1.5 px-0.5 text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "var(--color-faint)" }}
      >
        Appearance
      </div>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span
          className="flex items-center gap-1.5 text-[12.5px] font-medium"
          style={{ color: "var(--color-ink-soft)" }}
        >
          {isDark
            ? <Moon className="size-3.5" style={{ color: "var(--color-primary)" }} />
            : <Sun className="size-3.5" style={{ color: "var(--color-accent)" }} />
          }
          {isDark ? "Dark" : "Light"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleDark}
          className="relative shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-primary"
          style={{
            width: 44,
            height: 24,
            background: isDark
              ? "color-mix(in srgb, var(--color-primary) 75%, #000)"
              : "var(--color-surface-2)",
            border: "1px solid var(--color-line-strong)",
            transition: "background 0.2s",
          }}
        >
          <span
            className="absolute top-1/2 rounded-full"
            style={{
              width: 18,
              height: 18,
              left: 2,
              background: "#ffffff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)",
              transform: `translateY(-50%) translateX(${isDark ? 20 : 0}px)`,
              transition: "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
              pointerEvents: "none",
            }}
          />
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="Settings"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-primary"
        style={{
          background: open
            ? `color-mix(in srgb, var(--color-primary) 12%, ${btnBg})`
            : btnBg,
          border: open
            ? "1px solid var(--color-primary)"
            : `1px solid ${btnBorder}`,
          color: open ? "var(--color-primary)" : btnFg,
        }}
      >
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none" aria-hidden="true">
          <rect width="15" height="1.8" rx="0.9" fill="currentColor" />
          <rect y="4.6" width="15" height="1.8" rx="0.9" fill="currentColor" />
          <rect y="9.2" width="15" height="1.8" rx="0.9" fill="currentColor" />
        </svg>
      </button>

      {typeof document !== "undefined" && dropdown
        ? createPortal(dropdown, document.body)
        : null}
    </>
  );
}
