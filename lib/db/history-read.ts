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
