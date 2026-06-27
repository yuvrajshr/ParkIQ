import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import type { FunctionDeclaration, Part } from '@google/genai';
import type { ChatRequest, SimSnapshot, SnapshotHotspot, SnapshotOutcome } from '@/lib/ai/types';
import { createClient } from '@/lib/supabase/server';
import {
  queryDispatchHistory,
  queryKpiHistory,
  queryChatHistory,
} from '@/lib/db/history-read';

const TOP_HOTSPOTS = 5;
const TOP_FORECASTS = 3;
const HISTORY_SUMMARY_LIMIT = 20;

function minDiff(now: number, eta: number): number {
  return Math.max(1, Math.round(eta - now));
}

function buildOutcomesSection(outcomes: SnapshotOutcome[]): string {
  if (outcomes.length === 0) return '  (no dispatches yet this session)';
  return outcomes
    .map((o) => {
      const status = !o.arrived
        ? `en route (ETA sim-min ${o.etaMin})`
        : o.relapsed
          ? `RELAPSED after clearing`
          : `cleared · +${o.recoveredKmph.toFixed(1)} km/h recovered`;
      return `  - ${o.wardenName} → ${o.roadName}: CIS was ${o.cisBefore} · ${status}`;
    })
    .join('\n');
}

function buildSystemPrompt(s: SimSnapshot, historySummary: string): string {
  const topHotspots = [...s.hotspots].sort((a, b) => b.cis - a.cis).slice(0, TOP_HOTSPOTS);

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
    .map((w) => `  - ${w.name}: ${w.status}${w.assignedRoadId ? ` → ${w.assignedRoadId}` : ''}`)
    .join('\n');

  const outcomesSection = buildOutcomesSection(s.outcomes);

  return `You are the AI copilot for ParkIQ, a real-time illegal parking command dashboard for Bengaluru Traffic Police (ASTRaM project).
Help the controller make faster, smarter dispatch decisions. Be concise, cite real numbers, and be action-oriented.
Never invent data — reason only from the snapshot and history below.
You have access to tools: call get_dispatch_history, get_kpi_history, or get_chat_history when the user asks about past sessions or trends.

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

THIS SESSION — DISPATCH OUTCOMES
${outcomesSection}

RECENT HISTORY (last ${HISTORY_SUMMARY_LIMIT} events across all sessions)
${historySummary}

RULES
- Reference specific road names, CIS scores, and km/h figures from the snapshot above.
- For dispatch advice, mention the trade-off (CIS vs warden availability).
- Flag any chronic relapsed spot or imminent forecast (< 10 min away).
- Keep answers under 120 words unless the question needs a list.
- Plain language only — no markdown headers or asterisks.
- If you need deeper history, use the available tools — but call each tool at most once.
- If a tool returns no rows, tell the user plainly that no past data is recorded yet. Do NOT keep calling tools hoping for data.`;
}

const FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'get_dispatch_history',
    description:
      'Retrieve historical dispatch events from past sessions. Use when the user asks about past performance, which roads frequently have issues, warden effectiveness, or comparisons across sessions.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: {
          type: Type.NUMBER,
          description: 'Number of events to retrieve (default 20, max 50)',
        },
        road_name: {
          type: Type.STRING,
          description: 'Filter by specific road name (partial match)',
        },
        event_type: {
          type: Type.STRING,
          enum: ['all', 'cleared', 'relapsed'],
          description: 'Filter by outcome: all (default), cleared, or relapsed',
        },
      },
    },
  },
  {
    name: 'get_kpi_history',
    description:
      'Retrieve KPI snapshots from past sessions to analyse trends in violations, speed loss, and economic impact over time.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: {
          type: Type.NUMBER,
          description: 'Number of snapshots to retrieve (default 10)',
        },
      },
    },
  },
  {
    name: 'get_chat_history',
    description:
      'Retrieve past conversation messages from previous sessions when the user asks what was discussed before.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: {
          type: Type.NUMBER,
          description: 'Number of messages to retrieve (default 20)',
        },
      },
    },
  },
];

async function executeFunction(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const supabase = await createClient();

  if (name === 'get_dispatch_history') {
    return queryDispatchHistory(
      undefined, // cross-session: AI tools always query all history
      {
        limit: typeof args.limit === 'number' ? args.limit : 20,
        roadName: typeof args.road_name === 'string' ? args.road_name : undefined,
        eventType: args.event_type as 'all' | 'cleared' | 'relapsed' | undefined,
      },
      supabase,
    );
  }

  if (name === 'get_kpi_history') {
    return queryKpiHistory(
      undefined, // cross-session
      typeof args.limit === 'number' ? args.limit : 10,
      supabase,
    );
  }

  if (name === 'get_chat_history') {
    return queryChatHistory(
      undefined, // cross-session
      typeof args.limit === 'number' ? args.limit : 20,
      supabase,
    );
  }

  return { error: `Unknown function: ${name}` };
}

export async function POST(req: Request) {
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body?.message || !body?.snapshot) {
    return NextResponse.json({ error: 'message and snapshot required' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI service not configured — add GEMINI_API_KEY to .env.local' },
      { status: 503 },
    );
  }

  // Fetch the last 20 dispatch events to inject as a always-present summary
  let historySummary = '  (no history yet)';
  try {
    const supabase = await createClient();
    const rows = await queryDispatchHistory(undefined, { limit: HISTORY_SUMMARY_LIMIT }, supabase);
    if (rows.length > 0) {
      historySummary = rows
        .map((r) => {
          const outcome = r.relapsed
            ? 'RELAPSED'
            : r.arrived
              ? `cleared +${r.recovered_kmph.toFixed(1)} km/h`
              : 'en route';
          const date = new Date(r.created_at).toLocaleString('en-IN', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          });
          return `  - [${date}] ${r.warden_name} → ${r.road_name} (CIS ${r.cis_before}) · ${outcome}`;
        })
        .join('\n');
    }
  } catch {
    // Non-critical — proceed without history
  }

  const ai = new GoogleGenAI({ apiKey });

  const cappedHistory = (body.history ?? []).slice(-8);

  const chat = ai.chats.create({
    model: process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite',
    config: {
      tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
    },
    history: [
      { role: 'user', parts: [{ text: buildSystemPrompt(body.snapshot, historySummary) }] },
      {
        role: 'model',
        parts: [{ text: 'Understood. I am the ParkIQ AI copilot ready to help with dispatch decisions based on the current snapshot and historical data.' }],
      },
      ...cappedHistory.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    ],
  });

  const encoder = new TextEncoder();

  // Multi-round function-calling loop. Gemini frequently chains tool calls —
  // it may call get_kpi_history, see the result, then call get_dispatch_history
  // before producing any prose. Each of those turns has NO text part, so reading
  // .text() too early returns "" and the client hangs on an empty bubble forever.
  // We keep feeding tool results back until the model returns text (no more
  // function calls) or we hit the round cap, then always emit a non-empty answer.
  const MAX_FUNCTION_ROUNDS = 6;

  // Helper: turn a Gemini SDK error into a JSON error Response with the right status.
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

  let rounds = 0;
  while (rounds < MAX_FUNCTION_ROUNDS) {
    const calls = result.functionCalls ?? [];
    if (calls.length === 0) break;

    // Execute every function the model requested this round, in parallel.
    const responseParts: Part[] = await Promise.all(
      calls.map(async (fc) => {
        let fnResult: unknown;
        try {
          fnResult = await executeFunction(
            fc.name ?? '',
            (fc.args ?? {}) as Record<string, unknown>,
          );
        } catch {
          fnResult = { error: 'Query failed' };
        }
        return { functionResponse: { name: fc.name, response: { data: fnResult } } };
      }),
    );

    try {
      result = await chat.sendMessage({ message: responseParts });
    } catch (err) {
      return geminiErrorResponse(err);
    }
    rounds++;
  }

  // The model may still be requesting tools after the cap (e.g. repeatedly
  // querying empty history). Reading .text() then throws or returns "", so guard
  // it and fall back to an honest message — the client must always get prose.
  let finalText = result.text ?? '';
  if (!finalText.trim()) {
    finalText =
      "I couldn't pull that from the historical record — there may be no past session data stored yet. Ask me about the live situation and I can help right now.";
  }

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
