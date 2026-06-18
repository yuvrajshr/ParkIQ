"use client";

import { comma, rupees } from "@/lib/format";
import { useCountUp } from "@/lib/hooks/useCountUp";

interface Props {
  kmphLost: number;
  activeViolations: number;
  rupeesPerMin: number;
}

export default function KpiChips({ kmphLost, activeViolations, rupeesPerMin }: Props) {
  return (
    <div className="pointer-events-none absolute left-4 top-4 z-[1100]">
      <div
        className="pointer-events-auto relative flex items-stretch overflow-hidden rounded-2xl border border-white/10 text-white"
        style={{
          background: "rgba(13, 22, 38, 0.82)",
          backdropFilter: "blur(16px) saturate(1.25)",
          WebkitBackdropFilter: "blur(16px) saturate(1.25)",
          boxShadow: "var(--shadow-float), inset 0 1px 0 rgba(255,255,255,0.10)",
        }}
      >
        <LiveTag />
        <Stat value={kmphLost} fmt={comma} unit="km/h" label="Speed lost citywide" />
        <Divider />
        <Stat value={activeViolations} fmt={comma} label="Active violations" />
        <Divider />
        <Stat value={rupeesPerMin} fmt={rupees} unit="/min" label="Congestion cost now" />
      </div>
    </div>
  );
}

function LiveTag() {
  return (
    <div className="flex items-center gap-1.5 self-center pl-3.5 pr-0.5">
      <span className="relative flex h-2 w-2">
        <span className="live-dot absolute inline-flex h-full w-full rounded-full bg-heat-low" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-heat-low" />
      </span>
      <span className="font-display text-[9.5px] font-bold uppercase tracking-[0.18em] text-white/60">Live</span>
    </div>
  );
}

function Stat({
  value,
  fmt,
  unit,
  label,
}: {
  value: number;
  fmt: (n: number) => string;
  unit?: string;
  label: string;
}) {
  const v = useCountUp(value, { startAtZero: true });
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-baseline gap-1">
        <span className="tnum font-display text-[30px] font-bold leading-none tracking-[-0.03em] text-white">
          {fmt(v)}
        </span>
        {unit && <span className="text-[11px] font-medium text-white/50">{unit}</span>}
      </div>
      <div className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.09em] text-white/45">{label}</div>
    </div>
  );
}

function Divider() {
  return <div className="my-2.5 w-px bg-white/10" />;
}
