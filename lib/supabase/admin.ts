import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client authenticated with the service-role key.
 *
 * Used by the citizen-report routes to upload photos and insert/update rows while
 * bypassing RLS — citizens are NOT Supabase-auth users, so writes happen here on the
 * server after the app-level OTP check. NEVER import this from client components: the
 * service-role key must never reach the browser.
 *
 * Returns null when the key is absent so callers can fail with a clear message instead
 * of crashing. (Set SUPABASE_SERVICE_ROLE_KEY in .env.local.)
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
