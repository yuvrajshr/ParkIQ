// The PDF document for the controller's intelligence report. One <Page> per enabled section,
// official Bengaluru Traffic Police / ASTRaM styling, IBM Plex Sans throughout. Rendered to a
// Buffer in app/api/report/generate via renderToBuffer(). Server-only (Node fs font loading).

import path from "path";
import {
  Document,
  Page,
  View,
  Text,
  Font,
  StyleSheet,
} from "@react-pdf/renderer";
import type { ReactNode } from "react";
import {
  REPORT_COLORS as C,
  CATEGORY_PALETTE,
  HorizontalBarChart,
  StackedSeverityBar,
  PieChart,
  type BarDatum,
} from "./charts";
import type { DeltaValue, ReportData } from "./types";

// ── Fonts ─────────────────────────────────────────────────────────────────────────────────────────
// Absolute paths so this resolves the same in dev and on Vercel (public/ ships with the build).
const FONT_DIR = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "IBMPlexSans",
  fonts: [
    { src: path.join(FONT_DIR, "IBMPlexSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "IBMPlexSans-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(FONT_DIR, "IBMPlexSans-Bold.ttf"), fontWeight: 700 },
  ],
});
// Avoid hyphenation artifacts in justified prose.
Font.registerHyphenationCallback((word) => [word]);

const PAGE_W = 595.28;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2; // 499.28

const s = StyleSheet.create({
  page: {
    fontFamily: "IBMPlexSans",
    fontWeight: 400,
    fontSize: 10,
    color: C.ink,
    paddingTop: MARGIN,
    paddingBottom: 64,
    paddingHorizontal: MARGIN,
    backgroundColor: C.surface,
  },
  // Section header
  sectionEyebrow: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 2,
    color: C.primary,
    marginRight: 10,
  },
  sectionRule: { flexGrow: 1, height: 1, backgroundColor: C.line },
  sectionTitle: {
    fontSize: 19,
    fontWeight: 700,
    color: C.ink,
    letterSpacing: -0.4,
    marginTop: 7,
    marginBottom: 16,
  },
  subhead: {
    fontSize: 11,
    fontWeight: 600,
    color: C.inkSoft,
    marginBottom: 8,
    marginTop: 4,
  },
  body: { fontSize: 10, lineHeight: 1.6, color: C.inkSoft, marginBottom: 9 },
  muted: { fontSize: 9, color: C.muted },
  fallback: { fontSize: 9.5, lineHeight: 1.5, color: C.muted },
  footer: {
    position: "absolute",
    bottom: 30,
    left: MARGIN,
    right: MARGIN,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 6,
  },
  footerText: { fontSize: 7.5, color: C.faint },
});

// ── Date helpers ────────────────────────────────────────────────────────────────────────────────
// Pin to IST: this renders server-side (UTC on Vercel/Docker) but the cover page labels the
// timestamp "IST", so without an explicit timeZone the displayed dates/time would be wrong.
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

// ── Reusable pieces ─────────────────────────────────────────────────────────────────────────────
function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={s.sectionEyebrow}>{eyebrow}</Text>
        <View style={s.sectionRule} />
      </View>
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function PageFooter() {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>
        ASTRaM · Bengaluru Traffic Police — CONFIDENTIAL · For official use only
      </Text>
      <Text
        style={s.footerText}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}

function StatCard({ label, value, accent, delta }: { label: string; value: string; accent?: string; delta?: DeltaValue | null }) {
  const hasDelta = delta && delta.direction !== "flat";
  const deltaColor = delta?.direction === "up" ? C.heatCritical : C.heatLow;
  const deltaText = hasDelta
    ? `${delta.direction === "up" ? "↑" : "↓"} ${delta.pct != null ? `${delta.pct}%` : Math.abs(delta.change)} vs prior`
    : null;

  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: 0,
        backgroundColor: C.surface2,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 6,
        borderLeftWidth: 3,
        borderLeftColor: accent ?? C.primary,
        paddingVertical: 9,
        paddingHorizontal: 11,
      }}
    >
      <Text style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>{value}</Text>
      <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </Text>
      {deltaText && (
        <Text style={{ fontSize: 7, fontWeight: 600, color: deltaColor, marginTop: 3 }}>
          {deltaText}
        </Text>
      )}
    </View>
  );
}

function StatRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>{children}</View>;
}

// Generic table. Columns carry a flex weight + alignment.
interface Col {
  header: string;
  flex: number;
  align?: "left" | "right";
}
function Table({ cols, rows }: { cols: Col[]; rows: string[][] }) {
  return (
    <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 6, overflow: "hidden" }}>
      {/* header */}
      <View style={{ flexDirection: "row", backgroundColor: C.primary }}>
        {cols.map((c, i) => (
          <Text
            key={i}
            style={{
              flexGrow: c.flex,
              flexBasis: 0,
              fontSize: 8,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: 0.3,
              paddingVertical: 6,
              paddingHorizontal: 8,
              textAlign: c.align ?? "left",
            }}
          >
            {c.header}
          </Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View
          key={ri}
          style={{
            flexDirection: "row",
            backgroundColor: ri % 2 === 0 ? C.surface : C.surface2,
            borderTopWidth: ri === 0 ? 0 : 1,
            borderTopColor: C.line,
          }}
        >
          {r.map((cell, ci) => (
            <Text
              key={ci}
              style={{
                flexGrow: cols[ci].flex,
                flexBasis: 0,
                fontSize: 8.5,
                color: C.inkSoft,
                paddingVertical: 5,
                paddingHorizontal: 8,
                textAlign: cols[ci].align ?? "left",
              }}
            >
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function AiBlock({ text, label }: { text: string; label: string }) {
  const has = text.trim().length > 0;
  return (
    <View
      style={{
        backgroundColor: "#f3f7fc",
        borderLeftWidth: 3,
        borderLeftColor: C.accent,
        borderRadius: 4,
        paddingVertical: 8,
        paddingHorizontal: 11,
        marginTop: 12,
      }}
    >
      <Text style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 0.6, color: C.accent, marginBottom: 3 }}>
        {label}
      </Text>
      <Text style={has ? { fontSize: 9.5, lineHeight: 1.5, color: C.inkSoft } : s.fallback}>
        {has ? text : "AI recommendation unavailable for this section."}
      </Text>
    </View>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: C.surface2,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 6,
        padding: 12,
      }}
    >
      <Text style={s.fallback}>{children}</Text>
    </View>
  );
}

// ── Cover page ──────────────────────────────────────────────────────────────────────────────────
function CoverPage({ data }: { data: ReportData }) {
  const { virs, citizenStats, cctvStats } = data;
  const highRisk = virs.severity.critical + virs.severity.high;
  return (
    <Page size="A4" style={[s.page, { paddingHorizontal: 0, paddingTop: 0 }]}>
      {/* Header band */}
      <View style={{ backgroundColor: C.primary, paddingHorizontal: MARGIN, paddingTop: 40, paddingBottom: 26 }}>
        <Text style={{ fontSize: 9, color: "#cfe0f5", letterSpacing: 3, fontWeight: 600 }}>
          ASTRaM · ADAPTIVE TRAFFIC INTELLIGENCE
        </Text>
        <Text style={{ fontSize: 22, fontWeight: 700, color: "#ffffff", marginTop: 6, letterSpacing: -0.3 }}>
          Bengaluru Traffic Police
        </Text>
        <View style={{ height: 3, width: 70, backgroundColor: C.accent, marginTop: 12 }} />
      </View>

      <View style={{ paddingHorizontal: MARGIN, paddingTop: 46 }}>
        <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 1.5, fontWeight: 600 }}>
          ENFORCEMENT INTELLIGENCE REPORT
        </Text>
        <Text style={{ fontSize: 30, fontWeight: 700, color: C.ink, marginTop: 8, letterSpacing: -0.8, lineHeight: 1.15 }}>
          Parking Violation &amp;{"\n"}Congestion Impact Brief
        </Text>

        <View style={{ marginTop: 26, flexDirection: "row", gap: 36 }}>
          <View>
            <Text style={{ fontSize: 7.5, color: C.faint, letterSpacing: 0.6 }}>REPORTING PERIOD</Text>
            <Text style={{ fontSize: 11, fontWeight: 600, color: C.inkSoft, marginTop: 3 }}>
              {fmtDate(data.dateRange.from)} — {fmtDate(data.dateRange.to)}
            </Text>
          </View>
          <View>
            <Text style={{ fontSize: 7.5, color: C.faint, letterSpacing: 0.6 }}>ZONE COVERAGE</Text>
            <Text style={{ fontSize: 11, fontWeight: 600, color: C.inkSoft, marginTop: 3 }}>
              {data.zoneLabel}
            </Text>
          </View>
        </View>

        {/* KPI row */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 34 }}>
          <StatCard label="Hotspot clusters" value={String(virs.clusters.length)} accent={C.primary} />
          <StatCard label="High-risk zones" value={String(highRisk)} accent={C.heatCritical} />
          <StatCard label="Citizen reports" value={String(citizenStats.total)} accent={C.accent} delta={data.deltas.citizenTotal} />
          <StatCard label="CCTV detections" value={String(cctvStats.flagged)} accent={C.heatHigh} delta={data.deltas.cctvFlagged} />
        </View>

        <View style={{ marginTop: 40, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12 }}>
          <Text style={{ fontSize: 8.5, color: C.muted }}>
            Generated {fmtDateTime(data.generatedAt)} IST
            {virs.summary ? `  ·  Data source: ${virs.summary.dataSource === "real" ? "Live VIRS corpus" : "Sample fixture"}` : ""}
          </Text>
          <Text style={{ fontSize: 8.5, fontWeight: 700, color: C.heatCritical, marginTop: 6, letterSpacing: 0.5 }}>
            CONFIDENTIAL — FOR OFFICIAL USE ONLY
          </Text>
        </View>
      </View>
    </Page>
  );
}

// ── Executive summary ───────────────────────────────────────────────────────────────────────────
function ExecutiveSummaryPage({ data }: { data: ReportData }) {
  const summary = data.narrative?.executiveSummary?.trim();
  const paragraphs = summary ? summary.split(/\n\s*\n/).filter((p) => p.trim()) : [];
  return (
    <Page size="A4" style={s.page}>
      <SectionHeader eyebrow="01" title="Executive Summary" />
      {paragraphs.length > 0 ? (
        paragraphs.map((p, i) => (
          <Text key={i} style={s.body}>
            {p.trim()}
          </Text>
        ))
      ) : (
        <EmptyNote>
          AI narrative was unavailable at generation time (the model may be rate-limited). The
          quantitative findings in the following sections were produced directly from the data and
          are unaffected.
        </EmptyNote>
      )}
      <PageFooter />
    </Page>
  );
}

// ── VIRS hotspots ───────────────────────────────────────────────────────────────────────────────
function VirsPage({ data }: { data: ReportData }) {
  const { virs } = data;
  const meanVirs100 = virs.summary ? Math.round(virs.summary.meanVirs * 100) : null;
  const peakShare = virs.summary ? Math.round(virs.summary.peakShare * 100) : null;

  const zoneBars: BarDatum[] = virs.zoneCounts.map((z) => ({
    label: z.zone,
    value: z.violations,
    color: C.primary,
  }));

  const top = virs.clusters.slice(0, 10);
  const tableRows = top.map((c, i) => [
    String(i + 1),
    c.name ?? `Cluster #${c.clusterId}`,
    String(c.count.toLocaleString("en-IN")),
    String(c.severityIndex),
    `${Math.round(c.peakShare * 100)}%`,
  ]);

  return (
    <Page size="A4" style={s.page}>
      <SectionHeader eyebrow="02" title="VIRS Hotspot Analysis" />

      <StatRow>
        <StatCard label="Clusters in scope" value={String(virs.clusters.length)} />
        <StatCard label="Critical" value={String(virs.severity.critical)} accent={C.heatCritical} />
        <StatCard label="High" value={String(virs.severity.high)} accent={C.heatHigh} />
        <StatCard label="Mean risk index" value={meanVirs100 != null ? `${meanVirs100}` : "—"} accent={C.accent} />
        <StatCard label="Peak-hour share" value={peakShare != null ? `${peakShare}%` : "—"} accent={C.heatMid} />
      </StatRow>

      {virs.clusters.length === 0 ? (
        <EmptyNote>No VIRS clusters fall within the selected zones.</EmptyNote>
      ) : (
        <>
          <Text style={s.subhead}>Severity distribution</Text>
          <StackedSeverityBar
            segments={[
              { label: "Critical", value: virs.severity.critical, color: C.heatCritical },
              { label: "High", value: virs.severity.high, color: C.heatHigh },
              { label: "Medium", value: virs.severity.mid, color: C.heatMid },
              { label: "Low", value: virs.severity.low, color: C.heatLow },
            ]}
            width={CONTENT_W}
          />

          {zoneBars.length > 1 && (
            <>
              <Text style={[s.subhead, { marginTop: 18 }]}>Violations by zone</Text>
              <HorizontalBarChart bars={zoneBars} width={CONTENT_W} />
            </>
          )}

          <Text style={[s.subhead, { marginTop: 18 }]}>Top hotspots by severity</Text>
          <Table
            cols={[
              { header: "#", flex: 0.5, align: "left" },
              { header: "HOTSPOT", flex: 3 },
              { header: "VIOLATIONS", flex: 1.4, align: "right" },
              { header: "SEVERITY", flex: 1.2, align: "right" },
              { header: "PEAK", flex: 1, align: "right" },
            ]}
            rows={tableRows}
          />
        </>
      )}

      {data.config.sections.aiRecommendations && (
        <AiBlock label="AI RECOMMENDATION" text={data.narrative?.virsRec ?? ""} />
      )}
      <PageFooter />
    </Page>
  );
}

// ── Citizen reports ─────────────────────────────────────────────────────────────────────────────
function CitizenPage({ data }: { data: ReportData }) {
  const { citizenStats: cs } = data;
  const typeSlices = Object.entries(cs.byViolationType)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label, value, color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] }));

  const statusOrder = ["new", "reviewed", "resolved", "dismissed"];
  const statusLabel: Record<string, string> = {
    new: "New",
    reviewed: "Reviewed",
    resolved: "Resolved",
    dismissed: "Dismissed",
  };

  return (
    <Page size="A4" style={s.page}>
      <SectionHeader eyebrow="03" title="Citizen Reports" />

      <StatRow>
        <StatCard label="Total reports" value={String(cs.total)} delta={data.deltas.citizenTotal} />
        <StatCard label="AI-verified" value={String(cs.aiVerified)} accent={C.heatLow} />
        <StatCard label="AI-rejected" value={String(cs.aiRejected)} accent={C.muted} />
        <StatCard
          label="Avg confidence"
          value={cs.avgAiConfidence != null ? `${Math.round(cs.avgAiConfidence * 100)}%` : "—"}
          accent={C.accent}
        />
      </StatRow>

      {cs.total === 0 ? (
        <EmptyNote>No citizen reports were submitted in the selected period and zones.</EmptyNote>
      ) : (
        <View style={{ flexDirection: "row", gap: 24 }}>
          <View style={{ flexGrow: 1, flexBasis: 0 }}>
            <Text style={s.subhead}>Violation types</Text>
            <PieChart slices={typeSlices} size={120} />
          </View>
          <View style={{ width: 170 }}>
            <Text style={s.subhead}>Triage status</Text>
            {statusOrder
              .filter((k) => cs.byStatus[k])
              .map((k) => (
                <View
                  key={k}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 4,
                    borderBottomWidth: 1,
                    borderBottomColor: C.line,
                  }}
                >
                  <Text style={{ fontSize: 9.5, color: C.inkSoft }}>{statusLabel[k]}</Text>
                  <Text style={{ fontSize: 9.5, fontWeight: 600, color: C.ink }}>{cs.byStatus[k]}</Text>
                </View>
              ))}
          </View>
        </View>
      )}

      {data.config.sections.aiRecommendations && (
        <AiBlock label="AI RECOMMENDATION" text={data.narrative?.citizenRec ?? ""} />
      )}
      <PageFooter />
    </Page>
  );
}

// ── CCTV detections ─────────────────────────────────────────────────────────────────────────────
function CctvPage({ data }: { data: ReportData }) {
  const { cctvStats: cc } = data;
  const rows = cc.cameras.slice(0, 14).map((cam) => [
    cam.label ?? "Camera",
    cam.roadName ?? "—",
    String(cam.detections),
    cam.maxConfidence > 0 ? `${Math.round(cam.maxConfidence * 100)}%` : "—",
  ]);

  return (
    <Page size="A4" style={s.page}>
      <SectionHeader eyebrow="04" title="CCTV Detections" />

      <StatRow>
        <StatCard label="Frames analysed" value={String(cc.total)} />
        <StatCard label="Flagged" value={String(cc.flagged)} accent={C.heatHigh} delta={data.deltas.cctvFlagged} />
        <StatCard label="Cameras" value={String(cc.cameras.length)} accent={C.primary} />
        <StatCard
          label="Avg confidence"
          value={cc.avgConfidence != null ? `${Math.round(cc.avgConfidence * 100)}%` : "—"}
          accent={C.accent}
        />
      </StatRow>

      {cc.cameras.length === 0 ? (
        <EmptyNote>No CCTV detections recorded in the selected period and zones.</EmptyNote>
      ) : (
        <>
          <Text style={s.subhead}>Camera activity</Text>
          <Table
            cols={[
              { header: "CAMERA", flex: 2 },
              { header: "ROAD", flex: 2.4 },
              { header: "DETECTIONS", flex: 1.2, align: "right" },
              { header: "MAX CONF.", flex: 1.2, align: "right" },
            ]}
            rows={rows}
          />
        </>
      )}

      {data.config.sections.aiRecommendations && (
        <AiBlock label="AI RECOMMENDATION" text={data.narrative?.cctvRec ?? ""} />
      )}
      <PageFooter />
    </Page>
  );
}

// ── Dispatch activity ───────────────────────────────────────────────────────────────────────────
function DispatchPage({ data }: { data: ReportData }) {
  const { dispatchStats: ds } = data;
  const rows = ds.events.slice(0, 16).map((e) => [
    e.roadName,
    e.wardenName,
    `min ${e.dispatchedAtMin}`,
    `${Math.max(0, e.etaMin - e.dispatchedAtMin)} min`,
  ]);

  return (
    <Page size="A4" style={s.page}>
      <SectionHeader eyebrow="05" title="Dispatch Activity" />

      <StatRow>
        <StatCard label="Deployments" value={String(ds.total)} />
        <StatCard
          label="Avg response window"
          value={ds.avgEtaMin != null ? `${Math.round(ds.avgEtaMin)} min` : "—"}
          accent={C.accent}
        />
      </StatRow>

      {ds.events.length === 0 ? (
        <EmptyNote>
          No warden deployments are recorded for the selected zones. Dispatch history reflects the
          current server session; persistent records will populate once the dispatch store is wired
          to Supabase.
        </EmptyNote>
      ) : (
        <>
          <Text style={s.subhead}>Deployment log</Text>
          <Table
            cols={[
              { header: "ROAD", flex: 2.6 },
              { header: "WARDEN", flex: 2 },
              { header: "DISPATCHED", flex: 1.4, align: "right" },
              { header: "RESPONSE", flex: 1.2, align: "right" },
            ]}
            rows={rows}
          />
        </>
      )}

      {data.config.sections.aiRecommendations && (
        <AiBlock label="AI RECOMMENDATION" text={data.narrative?.dispatchRec ?? ""} />
      )}
      <PageFooter />
    </Page>
  );
}

// ── Consolidated AI recommendations ──────────────────────────────────────────────────────────────
function RecommendationsPage({ data }: { data: ReportData }) {
  const n = data.narrative;
  const items: { label: string; text: string }[] = [
    { label: "Hotspot enforcement", text: n?.virsRec ?? "" },
    { label: "Citizen reporting", text: n?.citizenRec ?? "" },
    { label: "CCTV monitoring", text: n?.cctvRec ?? "" },
    { label: "Warden dispatch", text: n?.dispatchRec ?? "" },
  ].filter((i) => i.text.trim());

  return (
    <Page size="A4" style={s.page}>
      <SectionHeader eyebrow="06" title="AI Recommendations" />
      {items.length === 0 ? (
        <EmptyNote>
          AI recommendations were unavailable at generation time. Refer to the quantitative findings
          in each section above.
        </EmptyNote>
      ) : (
        items.map((it, i) => (
          <View key={i} style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 11, fontWeight: 700, color: C.primary, marginBottom: 4 }}>
              {it.label}
            </Text>
            <Text style={{ fontSize: 10, lineHeight: 1.55, color: C.inkSoft }}>{it.text}</Text>
          </View>
        ))
      )}
      <PageFooter />
    </Page>
  );
}

// ── Model transparency ──────────────────────────────────────────────────────────────────────────
function ModelTransparencyPage({ data }: { data: ReportData }) {
  const mc = data.virs.modelCard;
  return (
    <Page size="A4" style={s.page}>
      <SectionHeader eyebrow="07" title="Model Transparency" />
      {!mc ? (
        <EmptyNote>Model metadata was unavailable at generation time.</EmptyNote>
      ) : (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            <StatCard label="Model" value={mc.modelType} />
            <StatCard label="XGBoost" value={mc.xgboostVersion} accent={C.muted} />
            <StatCard label="Validation AUC" value={mc.validationAuc.toFixed(3)} accent={C.heatLow} />
          </View>
          <Text style={s.subhead}>Target definition</Text>
          <Text style={s.body}>{mc.targetDefinition}</Text>
          <Text style={[s.subhead, { marginTop: 6 }]}>Known caveats</Text>
          {mc.knownCaveats.map((cav, i) => (
            <View key={i} style={{ flexDirection: "row", marginBottom: 5 }}>
              <Text style={{ fontSize: 9.5, color: C.accent, marginRight: 6 }}>•</Text>
              <Text style={{ fontSize: 9.5, lineHeight: 1.5, color: C.inkSoft, flexGrow: 1, flexBasis: 0 }}>
                {cav}
              </Text>
            </View>
          ))}
        </>
      )}

      <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 }}>
        <Text style={s.fallback}>
          Methodology notes: VIRS clusters are zoned geographically by coordinate. Dispatch figures
          reflect the current operational session. This report is generated on demand and reflects
          data available at the timestamp on the cover page.
        </Text>
      </View>
      <PageFooter />
    </Page>
  );
}

// ── Document ────────────────────────────────────────────────────────────────────────────────────
export function ReportDocument({ data }: { data: ReportData }) {
  const sec = data.config.sections;
  return (
    <Document
      title="ParkIQ Enforcement Intelligence Report"
      author="ASTRaM · Bengaluru Traffic Police"
      subject={`Parking violation report — ${data.zoneLabel}`}
    >
      <CoverPage data={data} />
      {sec.executiveSummary && <ExecutiveSummaryPage data={data} />}
      {sec.virsHotspots && <VirsPage data={data} />}
      {sec.citizenReports && <CitizenPage data={data} />}
      {sec.cctvDetections && <CctvPage data={data} />}
      {sec.dispatchActivity && <DispatchPage data={data} />}
      {sec.aiRecommendations && <RecommendationsPage data={data} />}
      {sec.modelTransparency && <ModelTransparencyPage data={data} />}
    </Document>
  );
}
