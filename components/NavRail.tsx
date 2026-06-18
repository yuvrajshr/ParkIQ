"use client";

import { useState, useEffect } from "react";

type IconProps = { className?: string };

const items = [
  { id: "command", label: "Command", active: true, icon: GridIcon },
  { id: "map", label: "Live map", active: false, icon: PinIcon },
  { id: "forecast", label: "Forecast", active: false, icon: PulseIcon },
  { id: "review", label: "After-action", active: false, icon: CheckIcon },
];

export default function NavRail() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleDark() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("parkiq-dark", String(next)); } catch {}
  }

  return (
    <nav
      className="relative z-20 flex w-16 shrink-0 flex-col items-center gap-2 border-r border-line py-4"
      style={{
        background: "rgba(255,255,255,0.62)",
        backdropFilter: "blur(14px) saturate(1.3)",
        WebkitBackdropFilter: "blur(14px) saturate(1.3)",
      }}
    >
      <div
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-ink text-white shadow-[0_8px_18px_-6px_rgba(27,95,176,0.85),inset_0_1px_0_rgba(255,255,255,0.25)]"
      >
        <span className="font-display text-[17px] font-extrabold leading-none">P</span>
      </div>

      {items.map(({ id, label, active, icon: Icon }) => (
        <button
          key={id}
          title={label}
          aria-label={label}
          aria-current={active ? "page" : undefined}
          className={`group relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
            active
              ? "bg-primary-wash text-primary shadow-[0_4px_12px_-6px_rgba(27,95,176,0.45)]"
              : "text-faint hover:bg-surface-2 hover:text-ink-soft"
          }`}
        >
          {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />}
          <Icon className="h-5 w-5" />
        </button>
      ))}

      <div className="mt-auto flex flex-col items-center gap-2">
        <button
          onClick={toggleDark}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-faint hover:bg-surface-2 hover:text-ink-soft focus-visible:outline-2 focus-visible:outline-primary"
        >
          {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
        </button>

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted ring-1 ring-line">
          BTP
        </div>
      </div>
    </nav>
  );
}

function GridIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="2.5" width="6" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11.5" y="2.5" width="6" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11.5" y="11.5" width="6" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function PinIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M10 17.5c3-3 5.5-5.6 5.5-9A5.5 5.5 0 1 0 4.5 8.5c0 3.4 2.5 6 5.5 9Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="10" cy="8.3" r="1.9" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function PulseIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M2 10.5h3l2-5 3 9 2-5.5 1.5 2.5H18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.6 10.2 9 12.4l4.2-4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MoonIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M17 13.5A7.5 7.5 0 0 1 6.5 3a7.5 7.5 0 1 0 10.5 10.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
