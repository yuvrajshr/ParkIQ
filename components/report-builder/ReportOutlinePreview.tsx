"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart3, Users, Cctv, Send, Sparkles, ShieldCheck, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReportConfig, ReportOutline } from "@/lib/report/types";

interface Props {
  config: ReportConfig;
}

interface CardSpec {
  key: keyof ReportConfig["sections"];
  icon: LucideIcon;
  title: string;
  count: (o: ReportOutline) => string;
}

const CARDS: CardSpec[] = [
  {
    key: "executiveSummary",
    icon: FileText,
    title: "Executive summary",
    count: () => "AI-generated at PDF time",
  },
  {
    key: "virsHotspots",
    icon: BarChart3,
    title: "VIRS hotspot analysis",
    count: (o) => `${o.counts.virsTotal} clusters · ${o.counts.virsHighRisk} high-risk`,
  },
  {
    key: "citizenReports",
    icon: Users,
    title: "Citizen reports",
    count: (o) => `${o.counts.citizenTotal} reports in range`,
  },
  {
    key: "cctvDetections",
    icon: Cctv,
    title: "CCTV detections",
    count: (o) => `${o.counts.cctvFlagged} flagged detections`,
  },
  {
    key: "dispatchActivity",
    icon: Send,
    title: "Dispatch activity",
    count: (o) => `${o.counts.dispatchTotal} deployments`,
  },
  {
    key: "aiRecommendations",
    icon: Sparkles,
    title: "AI recommendations",
    count: () => "AI-generated at PDF time",
  },
  {
    key: "modelTransparency",
    icon: ShieldCheck,
    title: "Model transparency",
    count: () => "Model card · AUC · caveats",
  },
];

export default function ReportOutlinePreview({ config }: Props) {
  const [outline, setOutline] = useState<ReportOutline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const controller = new AbortController();

    // Debounce: only the latest config (after 600ms of quiet) triggers a fetch. Loading/error
    // are set inside the callback rather than synchronously in the effect body, so rapid filter
    // toggles don't flash the skeleton on every change and we avoid cascading effect renders.
    timer.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/report/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
          signal: controller.signal,
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "Preview failed");
        setOutline(json.outline as ReportOutline);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Preview failed");
      } finally {
        // Don't clear loading when this run was superseded — a newer request is already in
        // flight and owns the loading state; clearing here would flash stale counts.
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 600);

    return () => {
      controller.abort();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [config]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="flex flex-col gap-4">
      <div className="panel rounded-2xl p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-ink">Report outline</h2>
          {outline && (
            <span className="text-sm text-muted">
              {fmt(outline.dateRange.from)} – {fmt(outline.dateRange.to)} · {outline.zoneLabel}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">
          The PDF includes the enabled sections below. Counts reflect your current filters.
        </p>
      </div>

      {error && (
        <div className="panel rounded-2xl border border-heat-critical/30 p-4 text-sm text-heat-critical">
          Couldn’t load preview counts: {error}. You can still generate the report.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CARDS.map((card) => {
          const enabled = config.sections[card.key];
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className={`panel flex items-start gap-3 rounded-2xl p-4 transition-opacity ${
                enabled ? "" : "opacity-45"
              }`}
            >
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                  enabled ? "bg-primary-wash text-primary" : "bg-surface-2 text-faint"
                }`}
              >
                <Icon className="size-4.5" />
              </div>
              <div className="min-w-0">
                <div
                  className={`text-sm font-semibold ${
                    enabled ? "text-ink" : "text-muted line-through"
                  }`}
                >
                  {card.title}
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  {!enabled ? (
                    "Disabled"
                  ) : loading || !outline ? (
                    <span className="inline-block h-3 w-24 animate-pulse rounded bg-surface-2" />
                  ) : (
                    card.count(outline)
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="px-1 text-xs text-muted">
        Executive summary and recommendations are written fresh by the AI when the PDF is generated.
      </p>
    </div>
  );
}
