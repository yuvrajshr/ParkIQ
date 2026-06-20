"use client";

import { ShieldCheck, ScanSearch } from "lucide-react";
import type { AiVerdict } from "@/lib/types";
import { useTranslation } from "@/lib/hooks/useTranslation";

/** Compact badge showing the Roboflow photo-verification verdict. Renders only for the two
 *  informative states: `violation` (model flagged it — primary/confirmed) and `no_violation`
 *  (a vehicle is present but unflagged — muted/"unverified"). `skipped`/null show nothing. */
export default function AiVerdictChip({
  verdict,
  confidence,
}: {
  verdict: AiVerdict | null;
  confidence: number | null;
}) {
  const { t } = useTranslation();
  if (verdict !== "violation" && verdict !== "no_violation") return null;

  const isViolation = verdict === "violation";
  const color = isViolation ? "var(--color-primary)" : "var(--color-faint)";
  const Icon = isViolation ? ShieldCheck : ScanSearch;
  const pct = isViolation && confidence != null && confidence > 0 ? ` ${Math.round(confidence * 100)}%` : "";

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
    >
      <Icon className="size-3" />
      {isViolation ? `${t("reports.aiViolation")}${pct}` : t("reports.aiUnverified")}
    </span>
  );
}
