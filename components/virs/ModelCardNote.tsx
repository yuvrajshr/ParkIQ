"use client";

import { Info } from "lucide-react";
import type { VirsModelCard, VirsSummary } from "@/lib/types";
import { useTranslation } from "@/lib/hooks/useTranslation";

// A small, honest model card. Shows the validation AUC, the data source (fixture vs real), and the
// model's known limitations verbatim from the bundle — so the score is never presented as gospel.
export default function ModelCardNote({
  modelCard,
  summary,
}: {
  modelCard: VirsModelCard | null;
  summary: VirsSummary | null;
}) {
  const { t } = useTranslation();
  const isFixture = summary?.dataSource === "fixture";

  return (
    <section className="panel flex flex-col rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Info className="size-4 text-primary" />
          <div className="eyebrow !mb-0">{t("virs.model.title")}</div>
        </div>
        {summary && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              background: isFixture ? "var(--color-accent-wash)" : "var(--color-primary-wash)",
              color: isFixture ? "var(--color-heat-high)" : "var(--color-primary)",
            }}
          >
            {isFixture ? t("virs.model.sampleData") : t("virs.model.liveData")}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-3">
        <div>
          <span className="tnum font-display text-[22px] font-bold leading-none text-ink">
            {modelCard ? modelCard.validationAuc.toFixed(3) : "—"}
          </span>
          <span className="ml-1 text-[11px] text-muted">{t("virs.model.auc")}</span>
        </div>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{t("virs.model.desc")}</p>
    </section>
  );
}
