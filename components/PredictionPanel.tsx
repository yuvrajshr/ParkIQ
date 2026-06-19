"use client";

import type { PredictedHotspot } from "@/lib/types";
import { heatColor } from "@/lib/heat";
import { useTranslation } from "@/lib/hooks/useTranslation";

interface Props {
  predictions: PredictedHotspot[];
  simMin: number;
  onSelect: (roadId: string) => void;
}

export default function PredictionPanel({ predictions, simMin, onSelect }: Props) {
  const { t } = useTranslation();
  const top = predictions.slice(0, 4);

  return (
    <section className="panel flex flex-col rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="eyebrow !text-accent">{t("prediction.title")}</div>
        <span className="flex h-2 w-2 items-center justify-center">
          <span className="ring-pulse absolute h-2 w-2 rounded-full border border-accent" />
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        </span>
      </div>

      {top.length === 0 ? (
        <div className="flex flex-1 flex-col justify-center py-3">
          <p className="font-display text-[14px] font-semibold text-ink-soft">{t("prediction.allClear")}</p>
          <p className="text-[12px] leading-relaxed text-muted">{t("prediction.noHotspots")}</p>
        </div>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {top.map((p) => (
            <li key={p.roadId}>
              <button
                onClick={() => onSelect(p.roadId)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
              >
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--color-accent)" }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-ink">{p.name}</span>
                  <span className="block truncate text-[11px] text-muted">{p.reason}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span
                    className="tnum block rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white"
                    style={{ background: heatColor(p.projectedCis) }}
                  >
                    {p.projectedCis}
                  </span>
                  <span className="tnum mt-0.5 block text-[9.5px] text-faint">
                    {t("prediction.inTime", { time: Math.max(1, Math.round(p.etaMin - simMin)) })}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
