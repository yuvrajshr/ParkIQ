"use client";

import { useCountUp } from "@/lib/hooks/useCountUp";
import { useTranslation } from "@/lib/hooks/useTranslation";

interface Props {
  recovered: number;
  cleared: number;
  relapsed: number;
}

const MAX = 36;
const R = 54;
const CX = 70;
const CY = 66;
const C = 2 * Math.PI * R;
const SWEEP = 0.75; // 270° gauge, open at the bottom

export default function EffectivenessGauge({ recovered, cleared, relapsed }: Props) {
  const { t } = useTranslation();
  const frac = Math.max(0, Math.min(1, recovered / MAX));
  const shown = useCountUp(recovered, { startAtZero: true });

  return (
    <section className="panel flex flex-col rounded-2xl p-4">
      <div className="eyebrow">{t("gauge.effectiveness")}</div>

      <div className="relative mx-auto mt-1" style={{ width: 140, height: 116 }}>
        <svg width="140" height="140" viewBox="0 0 140 132">
          <defs>
            <linearGradient id="gauge-recovered" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2e9e6b" />
              <stop offset="100%" stopColor="#46c98a" />
            </linearGradient>
          </defs>
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke="var(--color-surface-2)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${SWEEP * C} ${(1 - SWEEP) * C}`}
            transform={`rotate(135 ${CX} ${CY})`}
          />
          {frac > 0 && (
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke="url(#gauge-recovered)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${frac * SWEEP * C} ${C}`}
              transform={`rotate(135 ${CX} ${CY})`}
              style={{ transition: "stroke-dasharray 0.6s ease", filter: "drop-shadow(0 2px 5px rgba(46,158,107,0.4))" }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pb-2">
          <div className="flex items-baseline gap-0.5">
            <span className="text-[15px] font-semibold text-heat-low">+</span>
            <span className="tnum font-display text-[34px] font-bold leading-none text-ink">{Math.round(shown)}</span>
          </div>
          <span className="text-[10.5px] font-medium text-faint">{t("gauge.kmhRecovered")}</span>
        </div>
      </div>

      <div className="mt-1 text-center">
        {cleared === 0 ? (
          <p className="text-[12px] leading-relaxed text-muted">
            {t("gauge.sendWarden")}
          </p>
        ) : (
          <div className="space-y-0.5">
            <p className="text-[12px] text-muted">
              {t(cleared > 1 ? "gauge.spotsCleared" : "gauge.spotCleared", { count: cleared })}
            </p>
            {relapsed > 0 && (
              <p className="text-[11.5px] font-semibold text-heat-critical">
                {t("gauge.relapsedPatrol", { count: relapsed })}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
