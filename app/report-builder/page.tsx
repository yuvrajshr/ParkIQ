"use client";

// Controller-only report builder. proxy.ts gates this route (not in PUBLIC_PATHS), so an
// unauthenticated visitor is redirected to /login before this renders.

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import ReportConfigPanel from "@/components/report-builder/ReportConfigPanel";
import ReportOutlinePreview from "@/components/report-builder/ReportOutlinePreview";
import type { ReportConfig } from "@/lib/report/types";

const DEFAULT_CONFIG: ReportConfig = {
  zones: ["All"],
  preset: "last7d",
  sections: {
    executiveSummary: true,
    virsHotspots: true,
    citizenReports: true,
    cctvDetections: true,
    dispatchActivity: true,
    aiRecommendations: true,
    modelTransparency: true,
  },
};

export default function ReportBuilderPage() {
  const [config, setConfig] = useState<ReportConfig>(DEFAULT_CONFIG);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        let msg = "Generation failed";
        try {
          const j = await res.json();
          msg = j.error ?? msg;
        } catch {
          /* non-JSON error body */
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `ParkIQ_Report_${stamp}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-[1240px] px-6 py-8 sm:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Link
            href="/"
            className="flex size-10 items-center justify-center rounded-xl border border-line bg-surface text-ink-soft transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label="Back to command dashboard"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-white">
              <FileText className="size-5" />
            </div>
            <div>
              <div className="eyebrow text-muted">ASTRaM · Intelligence</div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">Generate Report</h1>
            </div>
          </div>
        </div>

        {/* Two-column: config + outline */}
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[380px_1fr]">
          <ReportConfigPanel
            config={config}
            onChange={setConfig}
            onGenerate={handleGenerate}
            generating={generating}
            error={error}
          />
          <ReportOutlinePreview config={config} />
        </div>
      </div>
    </div>
  );
}
