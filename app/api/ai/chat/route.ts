import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ChatRequest, SimSnapshot, SnapshotHotspot } from '@/lib/ai/types';

const TOP_HOTSPOTS = 5;
const TOP_FORECASTS = 3;

function minDiff(now: number, eta: number): number {
  return Math.max(1, Math.round(eta - now));
}

function buildSystemPrompt(s: SimSnapshot): string {
  const topHotspots = [...s.hotspots]
    .sort((a, b) => b.cis - a.cis)
    .slice(0, TOP_HOTSPOTS);

  const hotspotLines = topHotspots.length
    ? topHotspots
        .map(
          (h: SnapshotHotspot) =>
            `  - ${h.name} (${h.zone}): CIS ${h.cis} [${h.level}], ` +
            `${h.parkedVehicles} parked, ${h.observedKmph}/${h.freeFlowKmph} km/h, ` +
            `₹${h.rupeesPerMin}/min` +
            (h.chronic ? ', chronic' : '') +
            (h.nearLandmark ? `, near ${h.nearLandmark}` : ''),
        )
        .join('\n')
    : '  (none)';

  const forecastLines = s.predictions.slice(0, TOP_FORECASTS).length
    ? s.predictions
        .slice(0, TOP_FORECASTS)
        .map(
          (p) =>
            `  - ${p.name}: ~${minDiff(s.simMin, p.etaMin)} min away, projected CIS ${p.projectedCis}` +
            (p.recurring ? ' (recurring)' : '') +
            `. ${p.reason}`,
        )
        .join('\n')
    : '  (none in next window)';

  const wardenLines = s.wardens
    .map(
      (w) =>
        `  - ${w.name}: ${w.status}${w.assignedRoadId ? ` → ${w.assignedRoadId}` : ''}`,
    )
    .join('\n');

  const dispatchLines = s.dispatches.length
    ? s.dispatches
        .map(
          (d) =>
            `  - ${d.wardenName} → ${d.roadName}: ETA in ${minDiff(s.simMin, d.etaMin)} min, CIS was ${d.cisBefore}`,
        )
        .join('\n')
    : '  (none yet)';

  return `You are the AI copilot for ParkIQ, a real-time illegal parking command dashboard for Bengaluru Traffic Police (ASTRaM project).
Help the controller make faster, smarter dispatch decisions. Be concise, cite real numbers, and be action-oriented.
Never invent data — reason only from the snapshot below.

CURRENT STATE  ${s.wallClock} (sim-minute ${s.simMin}/90, Friday evening replay)

CITYWIDE KPIs
  Speed lost: ${s.kpis.totalKmphLost.toFixed(1)} km/h total
  Active violations: ${s.kpis.totalParkedVehicles} vehicles parked illegally
  Economic cost: ₹${s.kpis.totalRupeesPerMin.toFixed(0)}/min
  Recovered so far: ${s.effectiveness.totalRecovered.toFixed(1)} km/h
  Relapsed spots: ${s.effectiveness.relapsedCount}

TOP HOTSPOTS (by CIS)
${hotspotLines}

UPCOMING FORECASTS
${forecastLines}

WARDENS
${wardenLines}

ACTIVE DISPATCHES
${dispatchLines}

RULES
- Reference specific road names, CIS scores, and km/h figures from the snapshot above.
- For dispatch advice, mention the trade-off (CIS vs warden availability).
- Flag any chronic relapsed spot or imminent forecast (< 10 min away).
- Keep answers under 120 words unless the question needs a list.
- Plain language only — no markdown headers or asterisks.`;
}

export async function POST(req: Request) {
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body?.message || !body?.snapshot) {
    return NextResponse.json(
      { error: 'message and snapshot required' },
      { status: 400 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI service not configured — add GEMINI_API_KEY to .env.local' },
      { status: 503 },
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash' });

  // Cap history to last 8 messages to prevent prompt bloat
  const cappedHistory = (body.history ?? []).slice(-8);

  const chat = model.startChat({
    history: [
      { role: 'user', parts: [{ text: buildSystemPrompt(body.snapshot) }] },
      { role: 'model', parts: [{ text: 'Understood. I am the ParkIQ AI copilot ready to help with dispatch decisions based on the current snapshot.' }] },
      ...cappedHistory.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    ],
  });

  let result;
  try {
    result = await chat.sendMessageStream(body.message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gemini request failed';
    const isQuota =
      msg.includes('429') ||
      msg.includes('quota') ||
      msg.includes('Too Many Requests');
    return NextResponse.json(
      {
        error: isQuota
          ? 'AI quota exhausted — free-tier daily limit reached. Try again tomorrow or add billing at ai.google.dev.'
          : msg,
      },
      { status: isQuota ? 429 : 502 },
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) controller.enqueue(encoder.encode(text));
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
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
