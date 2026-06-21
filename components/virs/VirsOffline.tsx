"use client";

import { ServerCrash, RefreshCw } from "lucide-react";
import { useModeStore } from "@/store/useModeStore";
import { useTranslation } from "@/lib/hooks/useTranslation";

// Shown when the VIRS microservice can't be reached. Explains exactly how to start it and offers
// a one-click switch to Simulation mode so the dashboard is never a dead end.
export default function VirsOffline({ onRetry }: { onRetry: () => void }) {
  const setMode = useModeStore((s) => s.setMode);
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <div className="panel max-w-md rounded-2xl p-8 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-surface-2">
          <ServerCrash className="size-6 text-heat-high" />
        </div>
        <h2 className="font-display text-[18px] font-bold text-ink">{t("virs.offline.title")}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">{t("virs.offline.body")}</p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-surface-2 px-3 py-2 text-left text-[11.5px] text-ink-soft ring-1 ring-line">
          <code>cd virs-service{"\n"}./run.ps1</code>
        </pre>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-white transition-[transform,background-color] hover:bg-primary-ink active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <RefreshCw className="size-3.5" />
            {t("virs.offline.retry")}
          </button>
          <button
            onClick={() => setMode("sim")}
            className="rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t("virs.offline.switch")}
          </button>
        </div>
      </div>
    </div>
  );
}
