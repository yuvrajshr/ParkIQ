"use client";

import { X, MapPin, Send, Check, Loader2, Ban } from "lucide-react";
import type { CitizenReport, ReportStatus } from "@/lib/types";
import { STATUS_COLOR } from "@/lib/citizen/reportStatus";
import { relativeTime } from "@/lib/citizen/timeAgo";
import { useTranslation } from "@/lib/hooks/useTranslation";

interface Props {
  report: CitizenReport;
  busy: boolean;
  onStatus: (status: ReportStatus) => void;
  onDispatch: () => void;
  onClose: () => void;
}

export default function ReportDetail({ report: r, busy, onStatus, onDispatch, onClose }: Props) {
  const { t } = useTranslation();
  const ago = relativeTime(r.createdAt);
  const typeLabel = t(`report.type.${r.violationType}` as Parameters<typeof t>[0]);
  const dispatched = Boolean(r.dispatchId);

  return (
    <div className="glass scroll-quiet max-h-[calc(100%-2rem)] w-[340px] overflow-y-auto rounded-2xl p-3.5">
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="eyebrow !text-primary">{typeLabel}</div>
          <div className="truncate font-display text-[15px] font-bold leading-tight text-ink">
            {r.snappedRoadName ?? t("reports.unmatched")}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label={t("ai.close")}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-faint transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={r.photoUrl}
        alt={typeLabel}
        className="aspect-[4/3] w-full rounded-xl object-cover ring-1 ring-line"
      />

      <div className="mt-2.5 space-y-1.5 text-[12px]">
        <Row label={<MapPin className="size-3.5 text-muted" />}>
          <span className="tnum text-ink-soft">{r.lat.toFixed(5)}, {r.lng.toFixed(5)}</span>
          {r.accuracyM != null && (
            <span className="text-faint"> · {t("reports.accuracy", { m: Math.round(r.accuracyM) })}</span>
          )}
        </Row>
        <div className="flex items-center justify-between text-faint">
          <span>{t("reports.reportedBy", { phone: r.reporterMasked })}</span>
          <span className="tnum">{t(ago.key as Parameters<typeof t>[0], { n: ago.n })}</span>
        </div>
        {r.note && <p className="rounded-lg bg-surface-2 px-2.5 py-2 text-[12.5px] leading-relaxed text-ink-soft">“{r.note}”</p>}
      </div>

      {/* Status workflow */}
      <div className="mt-3 flex gap-1.5">
        {(["new", "reviewed", "resolved"] as ReportStatus[]).map((s) => {
          const active = r.status === s;
          const color = STATUS_COLOR[s];
          return (
            <button
              key={s}
              onClick={() => onStatus(s)}
              disabled={busy}
              aria-pressed={active}
              className="flex-1 rounded-lg border px-2 py-1.5 text-[11.5px] font-semibold transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary"
              style={{
                background: active ? `color-mix(in srgb, ${color} 16%, transparent)` : "var(--color-surface)",
                color: active ? color : "var(--color-muted)",
                borderColor: active ? color : "var(--color-line)",
              }}
            >
              {t(`reports.status.${s}` as Parameters<typeof t>[0])}
            </button>
          );
        })}
      </div>

      {/* Dispatch + dismiss */}
      <div className="mt-2 flex gap-1.5">
        <button
          onClick={onDispatch}
          disabled={busy || dispatched || !r.snappedRoadId}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12.5px] font-semibold text-white transition-[transform,background-color] active:scale-[0.98] hover:bg-primary-ink disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : dispatched ? <Check className="size-3.5" /> : <Send className="size-3.5" />}
          {dispatched ? t("reports.dispatchedToRoad", { road: r.snappedRoadName ?? "" }) : t("reports.dispatchWarden")}
        </button>
        <button
          onClick={() => onStatus("dismissed")}
          disabled={busy}
          aria-label={t("reports.dismiss")}
          title={t("reports.dismiss")}
          className="flex items-center justify-center rounded-lg border border-line bg-surface px-3 py-2 text-heat-critical transition-colors hover:border-heat-critical hover:bg-heat-critical/10 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Ban className="size-3.5" />
        </button>
      </div>
      {!r.snappedRoadId && (
        <p className="mt-1.5 text-center text-[11px] text-faint">{t("reports.noRoadForDispatch")}</p>
      )}
    </div>
  );
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      {label}
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}
