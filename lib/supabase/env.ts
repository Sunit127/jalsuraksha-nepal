/**
 * Public Supabase configuration (safe for the browser).
 * Supports both the new publishable key and the legacy anon key names.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

/** Demo/presentation features (demo logins, scenario controls, demo location). */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
