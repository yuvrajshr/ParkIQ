"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Radio, Inbox, Cctv, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mapReport, type CitizenReportRow } from "@/lib/citizen/mapReport";
import { ROAD_BY_ID } from "@/lib/seed/roads";
import type { AiVerdict } from "@/lib/types";
import { relativeTime } from "@/lib/citizen/timeAgo";
import { useTranslation } from "@/lib/hooks/useTranslation";
import SettingsMenu from "@/components/SettingsMenu";
import AiVerdictChip from "@/components/reports/AiVerdictChip";

type Source = "all" | "cctv" | "citizen";

interface FeedItem {
  kind: "cctv" | "citizen";
  id: string;
  photoUrl: string;
  at: string;
  verdict: AiVerdict | null;
  confidence: number | null;
  source: string;
  sub: string;
  flagged: boolean;
}

interface CctvRow {
  id: string;
  road_id: string;
  camera_label: string | null;
  photo_url: string;
  confidence: number | null;
  vehicle_count: number | null;
  detected_at: string;
}

export default function AreaViolationsPage({ params }: { params: Promise<{ roadId: string }> }) {
  const { roadId } = use(params);
  const { t } = useTranslation();
  const road = ROAD_BY_ID[roadId];
  const [items, setItems] = useState<FeedItem[]>([]);
  const [source, setSource] = useState<Source>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    Promise.all([
      supabase
        .from("cctv_violations")
        .select("*")
        .eq("road_id", roadId)
        .order("detected_at", { ascending: false }),
      supabase
        .from("citizen_reports")
        .select("*")
        .eq("snapped_road_id", roadId)
        .order("created_at", { ascending: false }),
    ]).then(([cctv, citizen]) => {
      if (!active) return;
      const cctvItems: FeedItem[] = ((cctv.data ?? []) as CctvRow[]).map((r) => ({
        kind: "cctv",
        id: r.id,
        photoUrl: r.photo_url,
        at: r.detected_at,
        verdict: (r.confidence ?? 0) > 0 ? "violation" : "no_violation",
        confidence: r.confidence,
        source: r.camera_label ?? t("violations.cctv"),
        sub: t("violations.vehiclesSeen", { n: r.vehicle_count ?? 0 }),
        flagged: (r.confidence ?? 0) > 0,
      }));
      const citizenItems: FeedItem[] = ((citizen.data ?? []) as CitizenReportRow[])
        .map(mapReport)
        .map((r) => ({
          kind: "citizen",
          id: r.id,
          photoUrl: r.photoUrl,
          at: r.createdAt,
          verdict: r.aiVerdict,
          confidence: r.aiConfidence,
          source: t("violations.citizen"),
          sub: t(`report.type.${r.violationType}` as Parameters<typeof t>[0]),
          flagged: r.aiVerdict === "violation",
        }));
      setItems(
        [...cctvItems, ...citizenItems].sort((a, b) => (a.at < b.at ? 1 : -1)),
      );
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [roadId, t]);

  const filtered = useMemo(
    () => (source === "all" ? items : items.filter((i) => i.kind === source)),
    [items, source],
  );
  const flaggedCount = useMemo(() => items.filter((i) => i.flagged).length, [items]);
  const cctvCount = useMemo(() => items.filter((i) => i.kind === "cctv").length, [items]);
  const citizenCount = items.length - cctvCount;

  return (
    <div className="flex min-h-screen w-full flex-col">
      {/* Header */}
      <header className="glass sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">{t("reports.backToCommand")}</span>
          </Link>
          <div className="min-w-0 leading-none">
            <div className="eyebrow !text-primary">{t("violations.eyebrow")}</div>
            <h1 className="truncate font-display text-[16px] font-bold tracking-tight text-ink">
              {road?.name ?? roadId}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="hidden items-center gap-1.5 rounded-full bg-heat-low/12 px-2.5 py-1 text-[11.5px] font-semibold text-heat-low sm:flex">
            <Radio className="live-dot size-3.5" />
            {t("reports.live")}
          </span>
          <SettingsMenu />
        </div>
      </header>

      {/* Summary + filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="flex items-center gap-4 text-[12.5px]">
          <Stat n={flaggedCount} label={t("violations.flagged")} accent />
          <Stat n={cctvCount} label={t("violations.cctv")} />
          <Stat n={citizenCount} label={t("violations.citizen")} />
        </div>
        <div className="flex items-center gap-1.5">
          {(["all", "cctv", "citizen"] as Source[]).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              aria-pressed={source === s}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                source === s ? "bg-primary text-white" : "bg-surface-2 text-muted hover:text-ink"
              }`}
            >
              {t(`violations.${s}` as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <main className="scroll-quiet flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-surface-2" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-faint">
              <Inbox className="size-6" />
            </span>
            <p className="text-[13px] leading-relaxed text-muted">{t("violations.empty")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((it) => {
              const ago = relativeTime(it.at);
              return (
                <article
                  key={`${it.kind}-${it.id}`}
                  className="panel group overflow-hidden rounded-2xl"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={it.photoUrl}
                      alt={it.sub}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />
                    <span
                      className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                      style={{ background: "color-mix(in srgb, var(--color-ink) 55%, transparent)" }}
                    >
                      {it.kind === "cctv" ? <Cctv className="size-3" /> : <User className="size-3" />}
                      {it.source}
                    </span>
                    <span className="absolute bottom-2 left-2">
                      <AiVerdictChip verdict={it.verdict} confidence={it.confidence} />
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                    <span className="truncate text-[12px] font-medium text-ink-soft">{it.sub}</span>
                    <span className="tnum shrink-0 text-[10.5px] text-faint">
                      {t(ago.key as Parameters<typeof t>[0], { n: ago.n })}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ n, label, accent }: { n: number; label: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="tnum text-[16px] font-bold" style={{ color: accent ? "var(--color-primary)" : "var(--color-ink)" }}>
        {n}
      </span>
      <span className="text-[11.5px] font-medium uppercase tracking-wide text-muted">{label}</span>
    </div>
  );
}
