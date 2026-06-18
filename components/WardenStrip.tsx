"use client";

import type { Warden, WardenStatus } from "@/lib/types";

const DOT: Record<WardenStatus, string> = {
  available: "var(--color-heat-low)",
  en_route: "var(--color-accent)",
  on_site: "var(--color-primary)",
  off: "var(--color-faint)",
};

const STATUS_LABEL: Record<WardenStatus, string> = {
  available: "Available",
  en_route: "En route",
  on_site: "On site",
  off: "Off duty",
};

export default function WardenStrip({ wardens }: { wardens: Warden[] }) {
  const available = wardens.filter((w) => w.status === "available").length;
  const active = wardens.filter((w) => w.status === "en_route" || w.status === "on_site").length;

  return (
    <section className="panel shrink-0 rounded-2xl p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="eyebrow">Field Wardens</div>
        <div className="text-[11.5px] text-muted">
          <span className="tnum font-semibold text-heat-low">{available}</span> available
          {active > 0 && (
            <>
              {" · "}
              <span className="tnum font-semibold text-primary">{active}</span> deployed
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {wardens.map((w) => {
          const live = w.status === "en_route" || w.status === "on_site";
          return (
            <div
              key={w.id}
              title={`${w.name} — ${STATUS_LABEL[w.status]}`}
              className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2 py-1.5 ring-1 ring-line transition-colors hover:bg-primary-wash"
            >
              <span
                className={`${live ? "live-dot " : ""}h-2 w-2 shrink-0 rounded-full`}
                style={{ background: DOT[w.status] }}
              />
              <span className="tnum truncate text-[11px] font-medium text-ink-soft">
                {w.name.replace("Warden Unit ", "U")}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
