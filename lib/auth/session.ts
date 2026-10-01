import "server-only";

import { cache } from "react";
import { redirect, unstable_rethrow } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { AppRole, Profile } from "@/types/domain";
import { canAccess, type AppArea } from "./roles";

export type SessionContext = {
  userId: string | null;
  email: string | null;
  isAnonymous: boolean;
  profile: Profile | null;
  role: AppRole | null;
};

const EMPTY: SessionContext = {
  userId: null,
  email: null,
  isAnonymous: false,
  profile: null,
  role: null,
};

/**
 * Current user + profile for this request (deduplicated per request).
 * Identity is verified with the Auth server (getUser), and the role is read
 * from public.profiles — never from client-supplied data.
 */
export const getSessionContext = cache(async (): Promise<SessionContext> => {
  if (!isSupabaseConfigured()) return EMPTY;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return EMPTY;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    return {
      userId: user.id,
      email: user.email ?? null,
      isAnonymous: Boolean(user.is_anonymous),
      profile: profile ?? null,
      role: user.is_anonymous ? null : (profile?.role ?? "citizen"),
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[auth] failed to load session", error);
    return EMPTY;
  }
});

export type AuthorizationResult =
  | { ok: true; session: SessionContext & { userId: string; role: AppRole } }
  | { ok: false; reason: "unauthenticated" | "forbidden"; session: SessionContext };

export async function authorize(area: AppArea): Promise<AuthorizationResult> {
  const session = await getSessionContext();
  if (!session.userId || session.isAnonymous || !session.role) {
    return { ok: false, reason: "unauthenticated", session };
  }
  if (!canAccess(session.role, area)) {
    return { ok: false, reason: "forbidden", session };
  }
  return { ok: true, session: session as SessionContext & { userId: string; role: AppRole } };
}

/**
 * For pages/layouts: redirect to login when signed out. Returns the result so
 * the caller can render an access-denied state for the wrong role.
 */
export async function requireArea(area: AppArea, nextPath: string) {
  const result = await authorize(area);
  if (!result.ok && result.reason === "unauthenticated") {
    redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);
  }
  return result;
}
