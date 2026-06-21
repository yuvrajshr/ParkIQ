"use client";

import { motion } from "framer-motion";
import { useModeStore } from "@/store/useModeStore";
import type { DashboardMode } from "@/lib/types";

const OPTIONS: { id: DashboardMode; label: string }[] = [
  { id: "virs", label: "VIRS" },
  { id: "sim", label: "Simulation" },
];

// Slider toggle pill: a single shared-layout indicator slides between the two options.
export default function ModeToggle() {
  const mode = useModeStore((s) => s.mode);
  const setMode = useModeStore((s) => s.setMode);

  const toggle = () => setMode(mode === "virs" ? "sim" : "virs");

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${mode === "virs" ? "Simulation" : "VIRS"} mode`}
      className="relative flex items-center rounded-full p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      style={{
        background: "var(--hdr-ai-bg)",
        border: "1px solid var(--hdr-ai-border)",
        backdropFilter: "blur(14px) saturate(1.6)",
        WebkitBackdropFilter: "blur(14px) saturate(1.6)",
        cursor: "pointer",
      }}
    >
      {OPTIONS.map(({ id, label }) => {
        const active = mode === id;
        return (
          <span
            key={id}
            aria-hidden="true"
            className="relative h-7 rounded-full px-3 text-[12px] font-semibold flex items-center"
            style={{
              color: active ? "var(--hdr-accent-fg)" : "var(--hdr-nav-inactive)",
              zIndex: 1,
              transition: "color 0.18s ease",
            }}
          >
            {active && (
              <motion.div
                layoutId="mode-slider"
                className="absolute inset-0 rounded-full"
                style={{ background: "var(--hdr-accent-bg)" }}
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative" style={{ zIndex: 1 }}>{label}</span>
          </span>
        );
      })}
    </button>
  );
}
