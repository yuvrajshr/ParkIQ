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
