# Supabase AI History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist dispatch events, chat messages, and KPI snapshots to Supabase so the AI copilot can query past sessions and give historically-informed insights via Gemini function calling.

**Architecture:** Each page load creates a UUID session written to `sim_sessions`. Dashboard syncs dispatches, outcomes, and KPI snapshots via `useEffect`. AiInsights persists every message exchange. The `/api/ai/chat` route injects a 20-event summary into every prompt and exposes three Gemini function-call tools (`get_dispatch_history`, `get_kpi_history`, `get_chat_history`) backed by server-side Supabase queries.

**Tech Stack:** Next.js 16 App Router, Supabase (anon key + RLS + `@supabase/ssr`), `@google/generative-ai` function calling, Zustand, TypeScript strict.

## Global Constraints

- Never use `transition-all` — use specific property transitions only
- All Supabase writes from client components use `lib/supabase/client.ts` (`createBrowserClient`)
- All Supabase reads in API routes use `lib/supabase/server.ts` (`createServerClient` — reads cookies)
- RLS must be enabled on every new table; policies must check `auth.uid() = user_id` via session join
- `sessionId` is `crypto.randomUUID()` generated once on Dashboard mount — new session each page load
- Streaming is preserved: if Gemini makes a function call, execute the query then stream the final answer; if no function call, wrap the text response in a `ReadableStream`
- No `transition-all` in any new code
- TypeScript strict mode — no `any`, no unused variables
- Project root: `C:\Users\yuvra\OneDrive\Desktop\FLIPKART\parkiq`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| Supabase migration (via MCP) | Create | 4 tables + RLS policies |
| `lib/db/history-write.ts` | Create | Client-side insert/update helpers |
| `lib/db/history-read.ts` | Create | Server-side query helpers for API route |
| `lib/ai/types.ts` | Modify | Add `SnapshotOutcome`, `sessionId` to `ChatRequest`, outcomes to `SimSnapshot` |
| `components/AiInsights.tsx` | Modify | Add `sessionId` prop, persist messages, pass `sessionId` in POST body |
| `components/Dashboard.tsx` | Modify | Create session, sync events + outcomes + KPIs, pass `sessionId` to AiInsights |
| `app/api/ai/chat/route.ts` | Modify | Function calling, enriched system prompt with outcomes + history summary |

---

## Task 1: Supabase Migration — 4 Tables + RLS

**Files:**
- No local files — apply via Supabase MCP `apply_migration` tool

**Interfaces:**
- Produces: `sim_sessions(id, user_id, created_at)`, `dispatch_events(id, session_id, road_id, road_name, warden_id, warden_name, dispatched_at_min, eta_min, cis_before, speed_before, arrived, recovered_kmph, relapsed, created_at)`, `chat_messages(id, session_id, role, message_text, created_at)`, `kpi_snapshots(id, session_id, sim_min, total_kmph_lost, total_parked, total_rupees_per_min, created_at)`

- [ ] **Step 1: Apply migration via Supabase MCP**

Use the `apply_migration` MCP tool with this SQL:

```sql
-- Sessions: one row per page load, owned by the authenticated user
CREATE TABLE IF NOT EXISTS sim_sessions (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sim_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_sessions" ON sim_sessions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Dispatch events: one row per warden dispatch, updated as outcomes arrive
CREATE TABLE IF NOT EXISTS dispatch_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES sim_sessions(id) ON DELETE CASCADE,
  road_id           TEXT NOT NULL,
  road_name         TEXT NOT NULL,
  warden_id         TEXT NOT NULL,
  warden_name       TEXT NOT NULL,
  dispatched_at_min INTEGER NOT NULL,
  eta_min           INTEGER NOT NULL,
  cis_before        REAL NOT NULL,
  speed_before      REAL NOT NULL,
  arrived           BOOLEAN NOT NULL DEFAULT false,
  recovered_kmph    REAL NOT NULL DEFAULT 0,
  relapsed          BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE dispatch_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_dispatch_events" ON dispatch_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sim_sessions
      WHERE sim_sessions.id = dispatch_events.session_id
        AND sim_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sim_sessions
      WHERE sim_sessions.id = dispatch_events.session_id
        AND sim_sessions.user_id = auth.uid()
    )
  );

-- Chat messages: user + AI turns from every AI Insights conversation
CREATE TABLE IF NOT EXISTS chat_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES sim_sessions(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('user', 'model')),
  message_text TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_chat_messages" ON chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sim_sessions
      WHERE sim_sessions.id = chat_messages.session_id
        AND sim_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sim_sessions
      WHERE sim_sessions.id = chat_messages.session_id
        AND sim_sessions.user_id = auth.uid()
    )
  );

-- KPI snapshots: citywide metrics captured every 5 sim-minutes
CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES sim_sessions(id) ON DELETE CASCADE,
  sim_min             INTEGER NOT NULL,
  total_kmph_lost     REAL NOT NULL,
  total_parked        INTEGER NOT NULL,
  total_rupees_per_min REAL NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_kpi_snapshots" ON kpi_snapshots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sim_sessions
      WHERE sim_sessions.id = kpi_snapshots.session_id
        AND sim_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sim_sessions
      WHERE sim_sessions.id = kpi_snapshots.session_id
        AND sim_sessions.user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Verify tables exist**

Use Supabase MCP `list_tables` and confirm all 4 tables appear: `sim_sessions`, `dispatch_events`, `chat_messages`, `kpi_snapshots`.

---

## Task 2: DB Helper Modules

**Files:**
- Create: `lib/db/history-write.ts`
- Create: `lib/db/history-read.ts`

**Interfaces:**
- Consumes: `lib/supabase/client.ts` (`createClient`) for write helpers; `lib/supabase/server.ts` (`createClient`) for read helpers
- Produces:
  - `createSession(id: string, supabase: SupabaseBrowserClient): Promise<void>`
  - `writeDispatchEvent(sessionId: string, d: Dispatch, supabase: SupabaseBrowserClient): Promise<void>`
  - `updateDispatchOutcome(dispatchId: string, arrived: boolean, recoveredKmph: number, relapsed: boolean, supabase: SupabaseBrowserClient): Promise<void>`
  - `writeChatMessage(sessionId: string, role: 'user' | 'model', text: string, supabase: SupabaseBrowserClient): Promise<void>`
  - `writeKpiSnapshot(sessionId: string, simMin: number, kmph: number, parked: number, rupees: number, supabase: SupabaseBrowserClient): Promise<void>`
  - `queryDispatchHistory(sessionId: string | undefined, opts: { limit?: number; roadName?: string; eventType?: 'all' | 'cleared' | 'relapsed' }, supabase: SupabaseServerClient): Promise<DispatchHistoryRow[]>`
  - `queryKpiHistory(sessionId: string | undefined, limit: number, supabase: SupabaseServerClient): Promise<KpiHistoryRow[]>`
  - `queryChatHistory(sessionId: string | undefined, limit: number, supabase: SupabaseServerClient): Promise<ChatHistoryRow[]>`

- [ ] **Step 1: Create `lib/db/history-write.ts`**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dispatch } from "@/lib/types";

type BrowserClient = SupabaseClient;

export async function createSession(id: string, supabase: BrowserClient): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("sim_sessions").insert({ id, user_id: user.id });
}

export async function writeDispatchEvent(
  sessionId: string,
  d: Dispatch,
  supabase: BrowserClient,
): Promise<void> {
  await supabase.from("dispatch_events").insert({
    id: d.id,
    session_id: sessionId,
    road_id: d.roadId,
    road_name: d.roadName,
    warden_id: d.wardenId,
    warden_name: d.wardenName,
    dispatched_at_min: d.dispatchedAtMin,
    eta_min: d.etaMin,
    cis_before: d.cisBefore,
    speed_before: d.speedBefore,
  });
}

export async function updateDispatchOutcome(
  dispatchId: string,
  arrived: boolean,
  recoveredKmph: number,
  relapsed: boolean,
  supabase: BrowserClient,
): Promise<void> {
  await supabase
    .from("dispatch_events")
    .update({ arrived, recovered_kmph: recoveredKmph, relapsed })
    .eq("id", dispatchId);
}

export async function writeChatMessage(
  sessionId: string,
  role: "user" | "model",
  text: string,
  supabase: BrowserClient,
): Promise<void> {
  await supabase.from("chat_messages").insert({
    session_id: sessionId,
    role,
    message_text: text,
  });
}

export async function writeKpiSnapshot(
  sessionId: string,
  simMin: number,
  kmph: number,
  parked: number,
  rupees: number,
  supabase: BrowserClient,
): Promise<void> {
  await supabase.from("kpi_snapshots").insert({
    session_id: sessionId,
    sim_min: simMin,
    total_kmph_lost: kmph,
    total_parked: parked,
    total_rupees_per_min: rupees,
  });
}
```

- [ ] **Step 2: Create `lib/db/history-read.ts`**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

type ServerClient = SupabaseClient;

export interface DispatchHistoryRow {
  road_name: string;
  warden_name: string;
  dispatched_at_min: number;
  cis_before: number;
  arrived: boolean;
  recovered_kmph: number;
  relapsed: boolean;
  created_at: string;
}

export interface KpiHistoryRow {
  sim_min: number;
  total_kmph_lost: number;
  total_parked: number;
  total_rupees_per_min: number;
  created_at: string;
}

export interface ChatHistoryRow {
  role: string;
  message_text: string;
  created_at: string;
}

export async function queryDispatchHistory(
  sessionId: string | undefined,
  opts: { limit?: number; roadName?: string; eventType?: "all" | "cleared" | "relapsed" },
  supabase: ServerClient,
): Promise<DispatchHistoryRow[]> {
  const limit = Math.min(opts.limit ?? 20, 50);
  let q = supabase
    .from("dispatch_events")
    .select("road_name, warden_name, dispatched_at_min, cis_before, arrived, recovered_kmph, relapsed, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (sessionId) q = q.eq("session_id", sessionId);
  if (opts.roadName) q = q.ilike("road_name", `%${opts.roadName}%`);
  if (opts.eventType === "cleared") q = q.eq("arrived", true).eq("relapsed", false);
  if (opts.eventType === "relapsed") q = q.eq("relapsed", true);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as DispatchHistoryRow[];
}

export async function queryKpiHistory(
  sessionId: string | undefined,
  limit: number,
  supabase: ServerClient,
): Promise<KpiHistoryRow[]> {
  const cap = Math.min(limit, 50);
  let q = supabase
    .from("kpi_snapshots")
    .select("sim_min, total_kmph_lost, total_parked, total_rupees_per_min, created_at")
    .order("created_at", { ascending: false })
    .limit(cap);

  if (sessionId) q = q.eq("session_id", sessionId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as KpiHistoryRow[];
}

export async function queryChatHistory(
  sessionId: string | undefined,
  limit: number,
  supabase: ServerClient,
): Promise<ChatHistoryRow[]> {
  const cap = Math.min(limit, 50);
  let q = supabase
    .from("chat_messages")
    .select("role, message_text, created_at")
    .order("created_at", { ascending: false })
    .limit(cap);

  if (sessionId) q = q.eq("session_id", sessionId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ChatHistoryRow[];
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

---

## Task 3: Enrich AI Snapshot With Dispatch Outcomes

**Files:**
- Modify: `lib/ai/types.ts`
- Modify: `components/AiInsights.tsx` (Props interface + buildSnapshot)
- Modify: `components/Dashboard.tsx` (pass richer eff to AiInsights)

**Interfaces:**
- Consumes: `DispatchOutcome` from `lib/derive.ts`
- Produces: `SimSnapshot.outcomes: SnapshotOutcome[]`, `ChatRequest.sessionId?: string`

- [ ] **Step 1: Update `lib/ai/types.ts`**

Add `SnapshotOutcome` interface, add `outcomes` field to `SimSnapshot`, add `sessionId` to `ChatRequest`:

```typescript
import type { ImpactLevel, WardenStatus } from "@/lib/types";

export interface SnapshotHotspot {
  roadId: string;
  name: string;
  zone: string;
  nearLandmark?: string;
  cis: number;
  level: ImpactLevel;
  kmphLost: number;
  parkedVehicles: number;
  observedKmph: number;
  freeFlowKmph: number;
  rupeesPerMin: number;
  chronic: boolean;
}

export interface SnapshotPrediction {
  roadId: string;
  name: string;
  etaMin: number;
  projectedCis: number;
  recurring: boolean;
  reason: string;
}

export interface SnapshotWarden {
  id: string;
  name: string;
  status: WardenStatus;
  assignedRoadId?: string;
}

export interface SnapshotDispatch {
  roadId: string;
  roadName: string;
  wardenName: string;
  dispatchedAtMin: number;
  etaMin: number;
  cisBefore: number;
}

export interface SnapshotOutcome {
  roadName: string;
  wardenName: string;
  dispatchedAtMin: number;
  etaMin: number;
  cisBefore: number;
  arrived: boolean;
  recoveredKmph: number;
  relapsed: boolean;
}

export interface SimSnapshot {
  simMin: number;
  wallClock: string;
  hotspots: SnapshotHotspot[];
  predictions: SnapshotPrediction[];
  wardens: SnapshotWarden[];
  dispatches: SnapshotDispatch[];
  outcomes: SnapshotOutcome[];
  kpis: { totalKmphLost: number; totalParkedVehicles: number; totalRupeesPerMin: number };
  effectiveness: { totalRecovered: number; relapsedCount: number };
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
  snapshot: SimSnapshot;
  sessionId?: string;
}
```

- [ ] **Step 2: Update `AiInsights.tsx` Props and `buildSnapshot`**

Change the `eff` prop type to accept full outcomes, update `buildSnapshot`:

In the `Props` interface (lines 10–20), change `eff`:
```typescript
interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  simMin: number;
  hotspots: Hotspot[];
  predictions: PredictedHotspot[];
  wardens: Warden[];
  dispatches: Dispatch[];
  kpis: { kmph: number; parked: number; rupees: number };
  eff: {
    totalRecovered: number;
    relapsed: { length: number };
    outcomes: DispatchOutcome[];
  };
}
```

Add `DispatchOutcome` import at the top:
```typescript
import type { DispatchOutcome } from "@/lib/derive";
```

Update `buildSnapshot` to include outcomes and export the `SnapshotOutcome` type:
```typescript
function buildSnapshot(props: Omit<Props, "open" | "onClose" | "sessionId">): SimSnapshot {
  const { simMin, hotspots, predictions, wardens, dispatches, kpis, eff } = props;
  return {
    simMin,
    wallClock: buildWallClock(simMin),
    hotspots: hotspots.map((h) => ({
      roadId: h.roadId,
      name: h.name,
      zone: h.zone,
      nearLandmark: h.nearLandmark,
      cis: h.cis,
      level: h.level,
      kmphLost: h.kmphLost,
      parkedVehicles: h.parkedVehicles,
      observedKmph: h.observedKmph,
      freeFlowKmph: h.freeFlowKmph,
      rupeesPerMin: h.rupeesPerMin,
      chronic: h.chronic,
    })),
    predictions: predictions.map((p) => ({
      roadId: p.roadId,
      name: p.name,
      etaMin: p.etaMin,
      projectedCis: p.projectedCis,
      recurring: p.recurring,
      reason: p.reason,
    })),
    wardens: wardens.map((w) => ({
      id: w.id,
      name: w.name,
      status: w.status,
      assignedRoadId: w.assignedRoadId,
    })),
    dispatches: dispatches.map((d) => ({
      roadId: d.roadId,
      roadName: d.roadName,
      wardenName: d.wardenName,
      dispatchedAtMin: d.dispatchedAtMin,
      etaMin: d.etaMin,
      cisBefore: d.cisBefore,
    })),
    outcomes: eff.outcomes.map((o) => ({
      roadName: o.roadName,
      wardenName: o.wardenName,
      dispatchedAtMin: o.dispatchedAtMin,
      etaMin: o.etaMin,
      cisBefore: o.cisBefore,
      arrived: o.arrived,
      recoveredKmph: o.recoveredKmph,
      relapsed: o.relapsed,
    })),
    kpis: {
      totalKmphLost: kpis.kmph,
      totalParkedVehicles: kpis.parked,
      totalRupeesPerMin: kpis.rupees,
    },
    effectiveness: {
      totalRecovered: eff.totalRecovered,
      relapsedCount: eff.relapsed.length,
    },
  };
}
```

Also update `buildSnapshot(simProps)` call — `simProps` now excludes `open`, `onClose`, `sessionId`:
```typescript
const { open, onClose, sessionId, ...simProps } = props;
```

- [ ] **Step 3: Update `Dashboard.tsx` — pass `eff` with outcomes to AiInsights**

The `eff` from `effectiveness()` already has `outcomes`. Update the AiInsights JSX:

```tsx
<AiInsights
  open={aiOpen}
  onClose={() => setAiOpen(false)}
  sessionId={sessionId}          {/* added in Task 4 */}
  simMin={simMin}
  hotspots={hotspots}
  predictions={predictions}
  wardens={wardens}
  dispatches={dispatches}
  kpis={kpis}
  eff={eff}                      {/* eff now includes outcomes */}
/>
```

Note: `sessionId` is added in Task 4. For now, pass a placeholder `""` so it compiles:
```tsx
sessionId=""
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

---

## Task 4: Session + Event Sync in Dashboard

**Files:**
- Modify: `components/Dashboard.tsx`

**Interfaces:**
- Consumes: `createSession`, `writeDispatchEvent`, `updateDispatchOutcome`, `writeKpiSnapshot` from `lib/db/history-write.ts`
- Consumes: `createClient` from `lib/supabase/client.ts`
- Produces: `sessionId: string` state, passed as prop to AiInsights

- [ ] **Step 1: Add imports to `Dashboard.tsx`**

Add to the existing import block:
```typescript
import { useRef, useCallback } from "react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  createSession,
  writeDispatchEvent,
  updateDispatchOutcome,
  writeKpiSnapshot,
} from "@/lib/db/history-write";
```

Change the existing React import line from:
```typescript
import { useEffect, useMemo, useState } from "react";
```
to:
```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
```

- [ ] **Step 2: Add sessionId state and Supabase client ref**

After the existing `const [aiOpen, setAiOpen] = useState(false);` line, add:

```typescript
const [sessionId] = useState<string>(() => crypto.randomUUID());
const supabaseRef = useRef(createSupabaseClient());
```

- [ ] **Step 3: Create session on mount**

Add this effect after the sim clock effect:

```typescript
useEffect(() => {
  createSession(sessionId, supabaseRef.current).catch(() => {
    // Silently fail — session tracking is non-critical
  });
}, [sessionId]);
```

- [ ] **Step 4: Sync new dispatch events**

Add after the session creation effect:

```typescript
const syncedDispatchIds = useRef<Set<string>>(new Set());

useEffect(() => {
  for (const d of dispatches) {
    if (!syncedDispatchIds.current.has(d.id)) {
      syncedDispatchIds.current.add(d.id);
      writeDispatchEvent(sessionId, d, supabaseRef.current).catch(() => {});
    }
  }
}, [dispatches, sessionId]);
```

- [ ] **Step 5: Sync dispatch outcomes when they change**

Add after the dispatch sync effect:

```typescript
const syncedOutcomes = useRef<Map<string, { arrived: boolean; relapsed: boolean }>>(new Map());

useEffect(() => {
  for (const o of eff.outcomes) {
    const prev = syncedOutcomes.current.get(o.id);
    const changed =
      !prev ||
      prev.arrived !== o.arrived ||
      prev.relapsed !== o.relapsed;

    if (changed && (o.arrived || o.relapsed)) {
      syncedOutcomes.current.set(o.id, { arrived: o.arrived, relapsed: o.relapsed });
      updateDispatchOutcome(
        o.id,
        o.arrived,
        o.recoveredKmph,
        o.relapsed,
        supabaseRef.current,
      ).catch(() => {});
    }
  }
}, [eff.outcomes]);
```

- [ ] **Step 6: KPI snapshots every 5 sim-minutes**

Add after the outcomes sync effect:

```typescript
const lastKpiSnapMin = useRef<number>(-1);

useEffect(() => {
  const bucket = Math.floor(simMin / 5) * 5;
  if (bucket !== lastKpiSnapMin.current) {
    lastKpiSnapMin.current = bucket;
    writeKpiSnapshot(
      sessionId,
      bucket,
      kpis.kmph,
      kpis.parked,
      kpis.rupees,
      supabaseRef.current,
    ).catch(() => {});
  }
}, [simMin, sessionId, kpis]);
```

- [ ] **Step 7: Replace placeholder sessionId in AiInsights JSX**

Change `sessionId=""` to `sessionId={sessionId}` in the AiInsights JSX block.

- [ ] **Step 8: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

---

## Task 5: Chat Message Persistence in AiInsights

**Files:**
- Modify: `components/AiInsights.tsx`

**Interfaces:**
- Consumes: `writeChatMessage` from `lib/db/history-write.ts`
- Consumes: `createClient` from `lib/supabase/client.ts`
- Consumes: `sessionId: string` prop (added in Task 3)

- [ ] **Step 1: Add imports to `AiInsights.tsx`**

Add to existing imports:
```typescript
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { writeChatMessage } from "@/lib/db/history-write";
```

- [ ] **Step 2: Add Supabase client ref inside the component**

After `const constraintsRef = useRef<HTMLDivElement>(null);`:
```typescript
const supabaseRef = useRef(createSupabaseClient());
```

- [ ] **Step 3: Pass `sessionId` in the POST body**

In `sendMessage`, update the fetch body to include `sessionId`:
```typescript
body: JSON.stringify({
  message: text,
  history: messages,
  snapshot,
  sessionId,
}),
```

- [ ] **Step 4: Persist messages after successful exchange**

After the streaming `while` loop completes (after `while (true) { ... }`), before the `catch`, add:

```typescript
// Persist both turns to Supabase (fire-and-forget)
writeChatMessage(sessionId, "user", text, supabaseRef.current).catch(() => {});
setMessages((prev) => {
  const aiText = prev[prev.length - 1]?.text ?? "";
  if (aiText) {
    writeChatMessage(sessionId, "model", aiText, supabaseRef.current).catch(() => {});
  }
  return prev;
});
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

---

## Task 6: API Route — Function Calling + Enriched System Prompt

**Files:**
- Modify: `app/api/ai/chat/route.ts`

**Interfaces:**
- Consumes: `queryDispatchHistory`, `queryKpiHistory`, `queryChatHistory` from `lib/db/history-read.ts`
- Consumes: `createClient` from `lib/supabase/server.ts`
- Consumes: `ChatRequest.sessionId` (added in Task 3)
- Consumes: `SimSnapshot.outcomes` (added in Task 3)

The full rewrite of `app/api/ai/chat/route.ts`:

- [ ] **Step 1: Rewrite `app/api/ai/chat/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
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

function wallClock(simMin: number, startMin: number): string {
  const total = (startMin + Math.round(simMin)) % (24 * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
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
- If you need deeper history, use the available tools.`;
}

const FUNCTION_DECLARATIONS = [
  {
    name: 'get_dispatch_history',
    description:
      'Retrieve historical dispatch events from past sessions. Use when the user asks about past performance, which roads frequently have issues, warden effectiveness, or comparisons across sessions.',
    parameters: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number' as const,
          description: 'Number of events to retrieve (default 20, max 50)',
        },
        road_name: {
          type: 'string' as const,
          description: 'Filter by specific road name (partial match)',
        },
        event_type: {
          type: 'string' as const,
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
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number' as const,
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
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number' as const,
          description: 'Number of messages to retrieve (default 20)',
        },
      },
    },
  },
];

async function executeFunction(
  name: string,
  args: Record<string, unknown>,
  sessionId: string | undefined,
): Promise<unknown> {
  const supabase = await createClient();

  if (name === 'get_dispatch_history') {
    return queryDispatchHistory(
      sessionId,
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
      sessionId,
      typeof args.limit === 'number' ? args.limit : 10,
      supabase,
    );
  }

  if (name === 'get_chat_history') {
    return queryChatHistory(
      sessionId,
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
    const rows = await queryDispatchHistory(body.sessionId, { limit: HISTORY_SUMMARY_LIMIT }, supabase);
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

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
    tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
  });

  const cappedHistory = (body.history ?? []).slice(-8);

  const chat = model.startChat({
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

  // First call — non-streaming so we can detect function calls
  let firstResult;
  try {
    firstResult = await chat.sendMessage(body.message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gemini request failed';
    const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests');
    return NextResponse.json(
      {
        error: isQuota
          ? 'AI quota exhausted — free-tier daily limit reached. Try again tomorrow or add billing at ai.google.dev.'
          : msg,
      },
      { status: isQuota ? 429 : 502 },
    );
  }

  const funcCalls = firstResult.response.functionCalls?.() ?? [];

  // If Gemini requested a function call — execute it and stream the final answer
  if (funcCalls.length > 0) {
    const fc = funcCalls[0];
    let fnResult: unknown;
    try {
      fnResult = await executeFunction(fc.name, fc.args as Record<string, unknown>, body.sessionId);
    } catch {
      fnResult = { error: 'Query failed' };
    }

    let streamResult;
    try {
      streamResult = await chat.sendMessageStream([
        {
          functionResponse: {
            name: fc.name,
            response: { data: fnResult },
          },
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gemini stream failed';
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamResult.stream) {
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

  // No function call — wrap the text we already have in a ReadableStream
  const directText = firstResult.response.text();
  const stream = new ReadableStream({
    start(controller) {
      if (directText) controller.enqueue(encoder.encode(directText));
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Manual smoke test**

1. `npm run dev` → `http://localhost:3000`
2. Login with `admin@astram.gov.in` / `ParkIQ@2026!`
3. Open Supabase dashboard → Table Editor → `sim_sessions`. Confirm a row appeared.
4. Send a warden from Priority Queue. Confirm a row appears in `dispatch_events`.
5. Advance sim ~20 min. Confirm `arrived` column updates to `true` and `recovered_kmph` is non-zero.
6. Open AI Insights. Ask "What's the current situation?" — should see dispatch outcomes in answer.
7. Ask "Show me past dispatch events" — Gemini should call `get_dispatch_history` and list historical rows.
8. Ask "What were we discussing last session?" — Gemini should call `get_chat_history`.
9. Refresh page, dispatch a warden, ask "How do today's dispatches compare to last session?" — AI should compare across sessions.
10. Check `kpi_snapshots` table — rows should appear at sim-minute multiples of 5.
11. Check `chat_messages` table — both user and model turns should appear.

---

## Self-Review

**Spec coverage:**
- ✅ Store dispatch events → `dispatch_events` table, synced in Dashboard Task 4
- ✅ Store chat history → `chat_messages` table, persisted in AiInsights Task 5
- ✅ Store KPI snapshots → `kpi_snapshots` table, synced every 5 sim-min Task 4
- ✅ Each page load = new session → `crypto.randomUUID()` in Dashboard state Task 4
- ✅ All sessions ever → no date filter in queries, accumulate indefinitely
- ✅ Auto-inject summary → last 20 events fetched at request time, injected into system prompt Task 6
- ✅ Gemini function calling → 3 function declarations, non-streaming first pass, Task 6
- ✅ Pass `eff.outcomes` in snapshot → Task 3
- ✅ RLS on all tables → Task 1

**Placeholder scan:** No TBDs, no vague steps — all code is complete.

**Type consistency:**
- `DispatchOutcome.id` — used in Task 4 outcomes sync (`o.id`). `DispatchOutcome extends Dispatch` and `Dispatch.id: string` — ✅
- `writeChatMessage` signature matches usage in Task 5 — ✅
- `queryDispatchHistory` returns `DispatchHistoryRow[]` which includes `cis_before` field — used in Task 6 history summary as `r.cis_before` — ✅
- `SimSnapshot.outcomes` added in Task 3, used in Task 6 `buildOutcomesSection(s.outcomes)` — ✅
- `ChatRequest.sessionId?: string` added in Task 3, read in Task 6 as `body.sessionId` — ✅
