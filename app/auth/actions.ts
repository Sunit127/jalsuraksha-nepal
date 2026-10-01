"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { DEMO_ACCOUNT_KEYS, DEMO_ACCOUNTS } from "@/lib/auth/demo-accounts";
import { homeForRole, safeRedirectPath } from "@/lib/auth/roles";
import { DEMO_MODE, isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { firstIssue, staffLoginSchema } from "@/lib/validation/schemas";
import type { AppRole } from "@/types/domain";

export type AuthFormState = { error?: string } | undefined;

async function roleForCurrentUser(): Promise<AppRole | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return data?.role ?? "citizen";
}

export async function staffSignIn(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return { error: "The service is not configured yet." };

  const parsed = staffLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      error:
        error.status === 400
          ? "Email or password is incorrect."
          : "Could not sign in right now. Please try again.",
    };
  }

  const role = await roleForCurrentUser();
  redirect(safeRedirectPath(formData.get("next")?.toString(), homeForRole(role)));
}

const demoKeySchema = z.enum(DEMO_ACCOUNT_KEYS as [string, ...string[]]);

export async function demoSignIn(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!DEMO_MODE) return { error: "Demo accounts are disabled." };
  const password = process.env.DEMO_ACCOUNT_PASSWORD;
  if (!isSupabaseConfigured() || !password) {
    return { error: "Demo accounts are not set up. Run `npm run demo:users` (see README)." };
  }

  const parsed = demoKeySchema.safeParse(formData.get("account"));
  if (!parsed.success) return { error: "Unknown demo account." };
  const account = DEMO_ACCOUNTS[parsed.data as keyof typeof DEMO_ACCOUNTS];

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: account.email, password });
  if (error) {
    console.error("[auth] demo sign-in failed", error.message);
    return { error: "Demo account sign-in failed. Run `npm run demo:users` to (re)create it." };
  }

  const role = await roleForCurrentUser();
  redirect(safeRedirectPath(formData.get("next")?.toString(), homeForRole(role)));
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
