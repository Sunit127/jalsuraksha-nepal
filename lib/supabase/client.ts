"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

let browserClient: SupabaseClient<Database> | undefined;

/** Singleton browser client (publishable key only; RLS applies). */
export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  }
  return browserClient;
}

/**
 * Realtime channels must join with the user's JWT, otherwise RLS treats the
 * subscriber as anonymous and filters out protected rows (e.g. SOS for
 * operators). The cookie session loads asynchronously, so resolve it and hand
 * the token to Realtime before subscribing.
 */
export async function prepareRealtime(): Promise<SupabaseClient<Database>> {
  const supabase = getSupabaseBrowserClient();
  try {
    // Loads (and refreshes if needed) the cookie session, then lets Realtime
    // pull the token through supabase-js' accessToken callback.
    await supabase.auth.getSession();
    await supabase.realtime.setAuth();
  } catch {
    // Fall back to anonymous access (public tables still stream).
  }
  return supabase;
}
