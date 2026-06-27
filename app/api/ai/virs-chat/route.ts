import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import type { VirsChatRequest } from '@/lib/ai/types';
import type { VirsCluster, DispatchRoiItem, VirsSummary, VirsModelCard } from '@/lib/types';

const TOP_CLUSTERS = 8;

function buildSystemPrompt(
  summary: VirsSummary | null,
  clusters: VirsCluster[],
  roi: DispatchRoiItem[],
  modelCard: VirsModelCard | null,
): string {
  const topByVirs = [...clusters].sort((a, b) => b.avgVirs - a.avgVirs).slice(0, TOP_CLUSTERS);
  const topRoi = roi.slice(0, 6);

  const summaryBlock = summary
    ? `  Violations analysed: ${summary.rows}
  Clusters scored: ${summary.clusters}
  High-risk clusters (VIRS > 70): ${summary.highRiskClusters}
  Mean VIRS score: ${Math.round(summary.meanVirs * 100)}/100
  Peak-hour share: ${Math.round(summary.peakShare * 100)}%
  Data source: ${summary.dataSource === 'real' ? 'Live field data' : 'Synthetic fixture (demo — not real violations)'}`
    : '  (summary unavailable — VIRS service may be offline)';

  const clusterLines = topByVirs.length
    ? topByVirs
        .map((c) => {
          const band = c.avgVirs >= 0.7 ? 'HIGH' : c.avgVirs >= 0.4 ? 'MEDIUM' : 'LOW';
          const peak = `${Math.round(c.peakShare * 100)}% peak-hour`;
          const vehicle = c.topVehicle ? `, top vehicle: ${c.topVehicle}` : '';
          return `  - Cluster ${c.clusterId}: VIRS ${Math.round(c.avgVirs * 100)}/100 [${band}], ${c.count} violations, ${peak}${vehicle}`;
        })
        .join('\n')
    : '  (no clusters scored)';

  const roiLines = topRoi.length
    ? topRoi
        .map(
          (r, i) =>
            `  ${i + 1}. Cluster ${r.clusterId}: ROI ${r.roi.toFixed(2)}, VIRS ${Math.round(r.avgVirs * 100)}/100, ${r.count} violations`,
        )
        .join('\n')
    : '  (no ROI data)';

  const modelBlock = modelCard
    ? `  Model: ${modelCard.modelType} (XGBoost ${modelCard.xgboostVersion})
  Validation AUC: ${modelCard.validationAuc.toFixed(3)}
  Target: ${modelCard.targetDefinition}
  Known caveats: ${modelCard.knownCaveats.slice(0, 3).join('; ')}`
    : '  (model card unavailable)';

  return `You are the AI copilot for ParkIQ's VIRS (Violation Impact Rating System) dashboard, deployed for Bengaluru Traffic Police (ASTRaM project).

VIRS uses an XGBoost model to score each illegal-parking cluster 0–100 representing the probability of causing a traffic bottleneck. Higher scores mean more urgent dispatch priority.

RISK BANDS
  Low:    VIRS < 40   — monitor only
  Medium: VIRS 40–70  — prioritise when wardens are available
  High:   VIRS > 70   — immediate dispatch recommended

CITYWIDE SUMMARY
${summaryBlock}

CLUSTERS BY IMPACT RISK (highest VIRS first)
${clusterLines}

DISPATCH ROI QUEUE (recommended warden send order)
${roiLines}

MODEL METADATA
${modelBlock}

RULES
- Reference specific cluster IDs and VIRS scores from the data above. Never invent data.
- For dispatch advice, cite both the ROI rank and the VIRS score.
- If the data source is "fixture/demo", note that the numbers are synthetic when relevant.
- Mention known model caveats only when directly relevant to the question asked.
- Keep answers under 120 words unless the question requires a list.
- Plain language only — no markdown headers or asterisks in your response.`;
}

export async function POST(req: Request) {
  let body: VirsChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body?.message || !body?.virsContext) {
    return NextResponse.json({ error: 'message and virsContext required' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI service not configured — add GEMINI_API_KEY to .env.local' },
      { status: 503 },
    );
  }

  const { summary, clusters, roi, modelCard } = body.virsContext;
  const systemPrompt = buildSystemPrompt(summary, clusters, roi, modelCard);

  const ai = new GoogleGenAI({ apiKey });

  const cappedHistory = (body.history ?? []).slice(-8);

  const chat = ai.chats.create({
    model: process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite',
    history: [
      { role: 'user', parts: [{ text: systemPrompt }] },
      {
        role: 'model',
        parts: [
          {
            text: 'Understood. I am the ParkIQ VIRS AI copilot. I can help you interpret cluster risk scores, prioritise dispatch decisions based on ROI, and explain what the model predicts.',
          },
        ],
      },
      ...cappedHistory.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    ],
  });

  function geminiErrorResponse(err: unknown): Response {
    const msg = err instanceof Error ? err.message : 'Gemini request failed';
    const isQuota =
      msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests');
    return NextResponse.json(
      {
        error: isQuota
          ? 'AI quota exhausted — free-tier daily limit reached. Try again tomorrow or add billing at ai.google.dev.'
          : msg,
      },
      { status: isQuota ? 429 : 502 },
    );
  }

  let result;
  try {
    result = await chat.sendMessage({ message: body.message });
  } catch (err) {
    return geminiErrorResponse(err);
  }

  let finalText = result.text ?? '';
  if (!finalText.trim()) {
    finalText = 'I could not generate a response. Please try again.';
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(finalText));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
