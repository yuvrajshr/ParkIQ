"use client";

import { useSimStore } from "@/store/useSimStore";
import { ZONES } from "@/lib/seed/roads";
import SimClock from "./SimClock";

export default function TopBar() {
  const query = useSimStore((s) => s.filters.query);
  const zone = useSimStore((s) => s.filters.zone);
  const setQuery = useSimStore((s) => s.setQuery);
  const setZone = useSimStore((s) => s.setZone);

  return (
    <header
      className="relative z-20 flex h-16 shrink-0 items-center gap-4 border-b border-line px-5"
      style={{
        background: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(14px) saturate(1.3)",
        WebkitBackdropFilter: "blur(14px) saturate(1.3)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85)",
      }}
    >
      <div className="flex items-center gap-2.5 pr-1">
        <div className="leading-tight">
          <div className="font-display text-[18px] font-extrabold tracking-[-0.02em] text-ink">
            Park<span className="text-primary">IQ</span>
          </div>
          <div className="text-[11px] font-medium text-faint">Bengaluru Traffic Command</div>
        </div>
      </div>

      <div className="relative ml-2 w-64">
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" viewBox="0 0 20 20" fill="none">
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="m14 14 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a road or landmark"
          className="h-9 w-full rounded-lg border border-line bg-surface-2 pl-9 pr-3 text-sm text-ink shadow-[inset_0_1px_2px_rgba(15,27,45,0.05)] transition-[border-color,background] placeholder:text-faint focus:border-primary focus:bg-surface focus:shadow-[inset_0_1px_2px_rgba(27,95,176,0.08)] focus:outline-none"
        />
      </div>

      <label className="relative">
        <span className="sr-only">Filter by zone</span>
        <select
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          className="h-9 cursor-pointer appearance-none rounded-lg border border-line bg-surface-2 pl-3 pr-8 text-sm font-medium text-ink-soft focus:border-primary focus:outline-none"
        >
          <option value="all">All zones</option>
          {ZONES.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
        <svg className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" viewBox="0 0 20 20" fill="none">
          <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </label>

      <div className="ml-auto">
        <SimClock />
      </div>
    </header>
  );
}
