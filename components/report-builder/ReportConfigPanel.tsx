"use client";

import { Loader2, FileDown } from "lucide-react";
import { REPORT_ZONES, type DatePreset, type ReportConfig, type ReportZone } from "@/lib/report/types";

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "last7d", label: "Last 7 days" },
  { id: "last30d", label: "Last 30 days" },
  { id: "lastQuarter", label: "Last quarter" },
  { id: "custom", label: "Custom range" },
];

const SECTION_META: { key: keyof ReportConfig["sections"]; label: string; hint: string }[] = [
  { key: "executiveSummary", label: "Executive summary", hint: "AI-written overview" },
  { key: "virsHotspots", label: "VIRS hotspot analysis", hint: "Clusters, severity, charts" },
  { key: "citizenReports", label: "Citizen reports", hint: "Volume, types, verification" },
  { key: "cctvDetections", label: "CCTV detections", hint: "Camera activity" },
  { key: "dispatchActivity", label: "Dispatch activity", hint: "Warden deployments" },
  { key: "aiRecommendations", label: "AI recommendations", hint: "Per-section guidance" },
  { key: "modelTransparency", label: "Model transparency", hint: "AUC, caveats" },
];

interface Props {
  config: ReportConfig;
  onChange: (next: ReportConfig) => void;
  onGenerate: () => void;
  generating: boolean;
  error: string | null;
}

export default function ReportConfigPanel({ config, onChange, onGenerate, generating, error }: Props) {
  function toggleZone(zone: ReportZone) {
    if (zone === "All") {
      onChange({ ...config, zones: ["All"] });
      return;
    }
    const current = config.zones.filter((z) => z !== "All");
    const next = current.includes(zone)
      ? current.filter((z) => z !== zone)
      : [...current, zone];
    onChange({ ...config, zones: next.length === 0 ? ["All"] : next });
  }

  function setPreset(preset: DatePreset) {
    onChange({ ...config, preset });
  }

  function toggleSection(key: keyof ReportConfig["sections"]) {
    onChange({ ...config, sections: { ...config.sections, [key]: !config.sections[key] } });
  }

  const zoneActive = (z: ReportZone) =>
    z === "All" ? config.zones.length === 1 && config.zones[0] === "All" : config.zones.includes(z);

  return (
    <div className="panel sticky top-6 flex flex-col gap-6 rounded-2xl p-5">
      {/* Zones */}
      <section>
        <h2 className="eyebrow mb-3 text-muted">Zones</h2>
        <div className="flex flex-wrap gap-2">
          {REPORT_ZONES.map((z) => {
            const active = zoneActive(z);
            return (
              <button
                key={z}
                type="button"
                onClick={() => toggleZone(z)}
                aria-pressed={active}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  active
                    ? "border-primary bg-primary text-white"
                    : "border-line bg-surface-2 text-ink-soft hover:bg-surface-3"
                }`}
              >
                {z === "All" ? "All zones" : z}
              </button>
            );
          })}
        </div>
      </section>

      {/* Date range */}
      <section>
        <h2 className="eyebrow mb-3 text-muted">Time period</h2>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => {
            const active = config.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                aria-pressed={active}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  active
                    ? "border-primary bg-primary-wash text-primary"
                    : "border-line bg-surface-2 text-ink-soft hover:bg-surface-3"
                } ${p.id === "custom" ? "col-span-2" : ""}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {config.preset === "custom" && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted">
              From
              <input
                type="date"
                value={config.customFrom ?? ""}
                max={config.customTo}
                onChange={(e) => onChange({ ...config, customFrom: e.target.value })}
                className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              To
              <input
                type="date"
                value={config.customTo ?? ""}
                min={config.customFrom}
                onChange={(e) => onChange({ ...config, customTo: e.target.value })}
                className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
              />
            </label>
          </div>
        )}
      </section>

      {/* Sections */}
      <section>
        <h2 className="eyebrow mb-3 text-muted">Sections</h2>
        <ul className="flex flex-col gap-1.5">
          {SECTION_META.map(({ key, label, hint }) => {
            const on = config.sections[key];
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => toggleSection(key)}
                  aria-pressed={on}
                  className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2 text-left transition-colors hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-ink">{label}</span>
                    <span className="text-xs text-muted">{hint}</span>
                  </span>
                  <span
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                      on ? "bg-primary" : "bg-line-strong"
                    }`}
                  >
                    <span
                      className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
                      style={{ transform: on ? "translateX(18px)" : "translateX(2px)" }}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Generate */}
      <section className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
        >
          {generating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <FileDown className="size-4" />
              Generate PDF
            </>
          )}
        </button>
        <p className="text-xs text-muted">
          Generation takes ~10–20 seconds while the AI narrative is prepared.
        </p>
        {error && <p className="text-xs font-medium text-heat-critical">{error}</p>}
      </section>
    </div>
  );
}
