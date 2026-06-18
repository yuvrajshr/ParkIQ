"use client";

export default function HeatLegend() {
  return (
    <div className="glass pointer-events-none absolute bottom-4 left-4 z-[1100] rounded-xl px-3 py-2.5">
      <div className="eyebrow mb-1.5">Congestion Impact Score</div>
      <div
        className="h-2 w-44 rounded-full"
        style={{ background: "linear-gradient(90deg, #2e9e6b 0%, #f2a900 45%, #e4572e 70%, #b3261e 100%)" }}
      />
      <div className="mt-1 flex w-44 justify-between text-[10px] font-medium text-faint">
        <span>Low</span>
        <span>Moderate</span>
        <span>Critical</span>
      </div>
    </div>
  );
}
