"use client";

import type { Dispatch } from "@/lib/types";
import type { DispatchOutcome } from "@/lib/derive";
import { SIM_START_MIN_OF_DAY } from "@/lib/sim/engine";
import { useTranslation } from "@/lib/hooks/useTranslation";

type EventType = "dispatched" | "cleared" | "relapsed";

interface ActivityEvent {
  type: EventType;
  road: string;
  warden: string;
  min: number;
  recovered?: number;
}

const DOT_COLOR: Record<EventType, string> = {
  dispatched: "var(--color-accent)",
  cleared: "var(--color-heat-low)",
  relapsed: "var(--color-heat-high)",
};

function fmtMin(simMin: number): string {
  const total = (SIM_START_MIN_OF_DAY + Math.round(simMin)) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface Props {
  dispatches: Dispatch[];
  outcomes: DispatchOutcome[];
}

export default function RecentActivity({ dispatches, outcomes }: Props) {
  const { t } = useTranslation();

  const events: ActivityEvent[] = [];

  for (const d of dispatches) {
    events.push({
      type: "dispatched",
      road: d.roadName,
      warden: d.wardenName,
      min: d.dispatchedAtMin,
    });
  }

  for (const o of outcomes) {
    if (o.arrived) {
      events.push({
        type: o.relapsed ? "relapsed" : "cleared",
        road: o.roadName,
        warden: o.wardenName,
        min: o.etaMin,
        recovered: o.relapsed ? undefined : o.recoveredKmph,
      });
    }
  }

  events.sort((a, b) => b.min - a.min);
  const recent = events.slice(0, 6);

  const TYPE_LABEL: Record<EventType, string> = {
    dispatched: t("activity.dispatched"),
    cleared: t("activity.cleared"),
    relapsed: t("activity.relapsed"),
  };

  return (
    <div className="panel rounded-2xl p-5 shrink-0">
      <div className="eyebrow mb-4">{t("activity.title")}</div>
      {recent.length === 0 ? (
        <p className="text-xs text-muted py-1">{t("activity.empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {recent.map((ev, i) => {
            const dot = DOT_COLOR[ev.type];
            const label = TYPE_LABEL[ev.type];
            return (
              <div key={i} className="flex items-start gap-3">
                <span
                  className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
                  style={{ background: dot }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[11px] font-semibold uppercase tracking-[0.06em]"
                      style={{ color: dot }}
                    >
                      {label}
                    </span>
                    <span className="tnum shrink-0 text-[11px] text-muted">{fmtMin(ev.min)}</span>
                  </div>
                  <div className="truncate text-[12px] font-medium text-ink">{ev.road}</div>
                  <div className="truncate text-[11px] text-muted">
                    {ev.type === "dispatched"
                      ? t("activity.toWarden", { warden: ev.warden })
                      : t("activity.byWarden", { warden: ev.warden })}
                    {ev.recovered !== undefined && ev.recovered > 0 && (
                      <span className="ml-1" style={{ color: "var(--color-heat-low)" }}>
                        +{ev.recovered.toFixed(1)} km/h
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
