// Self-contained chart primitives for the PDF report, built on @react-pdf/renderer.
// Bars and stacked segments use layout Views (crisper than SVG in react-pdf); the pie
// uses SVG <Path> arcs. Every component takes plain data props and fixed dimensions so
// the renderer never has to measure dynamically.

import { View, Text, Svg, Path, G } from "@react-pdf/renderer";

export const REPORT_COLORS = {
  primary: "#1b5fb0",
  accent: "#f2a900",
  ink: "#0f1b2d",
  inkSoft: "#2b3a4d",
  muted: "#5b6b7b",
  faint: "#8a99a8",
  bg: "#eef2f5",
  surface: "#ffffff",
  surface2: "#f7f9fb",
  line: "#e1e7ee",
  heatLow: "#2e9e6b",
  heatMid: "#f2a900",
  heatHigh: "#e4572e",
  heatCritical: "#b3261e",
} as const;

// A rotating palette for categorical charts (pie slices, multi-series bars).
export const CATEGORY_PALETTE = [
  "#1b5fb0",
  "#f2a900",
  "#2e9e6b",
  "#e4572e",
  "#7b5ea7",
  "#5b6b7b",
] as const;

// ── Horizontal bar chart (e.g. violations by zone) ───────────────────────────────────────────────

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

export function HorizontalBarChart({
  bars,
  width = 483,
  unit = "",
}: {
  bars: BarDatum[];
  width?: number;
  unit?: string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const LABEL_W = 96;
  const VALUE_W = 52;
  const trackW = width - LABEL_W - VALUE_W;

  return (
    <View style={{ width }}>
      {bars.map((b, i) => {
        const fillW = Math.max(2, (b.value / max) * trackW);
        return (
          <View
            key={`${b.label}-${i}`}
            style={{ flexDirection: "row", alignItems: "center", marginBottom: 7 }}
          >
            <Text
              style={{ width: LABEL_W, fontSize: 8.5, color: REPORT_COLORS.muted, paddingRight: 6 }}
            >
              {b.label}
            </Text>
            <View
              style={{
                width: trackW,
                height: 14,
                backgroundColor: REPORT_COLORS.line,
                borderRadius: 3,
              }}
            >
              <View
                style={{
                  width: fillW,
                  height: 14,
                  backgroundColor: b.color ?? REPORT_COLORS.primary,
                  borderRadius: 3,
                }}
              />
            </View>
            <Text
              style={{
                width: VALUE_W,
                fontSize: 8.5,
                color: REPORT_COLORS.ink,
                fontFamily: "IBMPlexSans",
                fontWeight: 600,
                textAlign: "right",
              }}
            >
              {b.value.toLocaleString("en-IN")}
              {unit}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Stacked severity bar (critical / high / mid / low) ───────────────────────────────────────────

export interface SeverityDatum {
  label: string;
  value: number;
  color: string;
}

export function StackedSeverityBar({
  segments,
  width = 483,
}: {
  segments: SeverityDatum[];
  width?: number;
}) {
  const total = Math.max(1, segments.reduce((s, x) => s + x.value, 0));
  const visible = segments.filter((s) => s.value > 0);

  return (
    <View style={{ width }}>
      <View
        style={{
          flexDirection: "row",
          width,
          height: 22,
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        {visible.map((s, i) => (
          <View
            key={`${s.label}-${i}`}
            style={{ width: (s.value / total) * width, height: 22, backgroundColor: s.color }}
          />
        ))}
      </View>
      {/* Legend */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8, gap: 14 }}>
        {segments.map((s) => (
          <View key={s.label} style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: s.color, marginRight: 5 }}
            />
            <Text style={{ fontSize: 8.5, color: REPORT_COLORS.inkSoft }}>
              {s.label} ({s.value})
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Pie chart (SVG arcs + legend) ────────────────────────────────────────────────────────────────

export interface PieDatum {
  label: string;
  value: number;
  color?: string;
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const largeArc = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

export function PieChart({ slices, size = 120 }: { slices: PieDatum[]; size?: number }) {
  const data = slices.filter((s) => s.value > 0);
  const total = data.reduce((s, x) => s + x.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;

  const TAU = 2 * Math.PI;
  const START = -Math.PI / 2; // 12 o'clock
  const paths = data.map((s, i) => {
    // Each slice begins where the cumulative value of all prior slices lands. Derived from a
    // prefix sum rather than a mutable accumulator so the render stays pure (n ≤ palette size).
    const priorValue = data.slice(0, i).reduce((sum, x) => sum + x.value, 0);
    const start = START + (total > 0 ? priorValue / total : 0) * TAU;
    const sweep = total > 0 ? (s.value / total) * TAU : 0;
    // Guard the full-circle case (single slice) — a 360° arc collapses to a point.
    const end = data.length === 1 ? start + TAU - 0.0001 : start + sweep;
    const d = arcPath(cx, cy, r, start, end);
    return { d, color: s.color ?? CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] };
  });

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G>
          {paths.map((p, i) => (
            <Path key={i} d={p.d} fill={p.color} />
          ))}
        </G>
      </Svg>
      <View style={{ marginLeft: 18, flexGrow: 1 }}>
        {data.map((s, i) => {
          const color = s.color ?? CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
          const share = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <View
              key={s.label}
              style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}
            >
              <View
                style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: color, marginRight: 7 }}
              />
              <Text style={{ fontSize: 9, color: REPORT_COLORS.inkSoft, flexGrow: 1 }}>
                {s.label}
              </Text>
              <Text
                style={{
                  fontSize: 9,
                  color: REPORT_COLORS.ink,
                  fontFamily: "IBMPlexSans",
                  fontWeight: 600,
                }}
              >
                {s.value} · {share}%
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
