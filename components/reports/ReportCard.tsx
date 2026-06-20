"use client";

import type { CitizenReport } from "@/lib/types";
import { STATUS_COLOR, STATUS_I18N } from "@/lib/citizen/reportStatus";
import { relativeTime } from "@/lib/citizen/timeAgo";
import { useTranslation } from "@/lib/hooks/useTranslation";
import AiVerdictChip from "./AiVerdictChip";

interface Props {
  report: CitizenReport;
  selected: boolean;
  onSelect: (id: string) => void;
}

export default function ReportCard({ report: r, selected, onSelect }: Props) {
  const { t } = useTranslation();
  const color = STATUS_COLOR[r.status];
  const ago = relativeTime(r.createdAt);
  const typeLabel = t(`report.type.${r.violationType}` as Parameters<typeof t>[0]);

  return (
    <button
      onClick={() => onSelect(r.id)}
      className={`elev-hover flex w-full items-center gap-3 rounded-xl border p-2.5 text-left ${
        selected ? "border-primary bg-primary-wash" : "border-line bg-surface"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={r.photoUrl}
        alt=""
        loading="lazy"
        className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-line"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[13.5px] font-semibold leading-tight text-ink">
          {typeLabel}
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-muted">
          {r.snappedRoadName ? t("reports.nearRoad", { road: r.snappedRoadName }) : t("reports.unmatched")}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="tnum text-[10.5px] text-faint">{t(ago.key as Parameters<typeof t>[0], { n: ago.n })}</span>
          <AiVerdictChip verdict={r.aiVerdict} confidence={r.aiConfidence} />
        </div>
      </div>
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
        style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
      >
        {t(STATUS_I18N[r.status] as Parameters<typeof t>[0])}
      </span>
    </button>
  );
}
