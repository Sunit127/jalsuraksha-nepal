import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { SUPABASE_URL } from "./env";

/**
 * Privileged client using the secret/service-role key. Bypasses RLS.
 * Server-only: use exclusively in route handlers / server actions after doing
 * your own validation and authorization.
 */
export function createSupabaseAdminClient(): SupabaseClient<Database> {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) {
    throw new Error("Supabase admin client is not configured (SUPABASE_SECRET_KEY missing)");
  }
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
