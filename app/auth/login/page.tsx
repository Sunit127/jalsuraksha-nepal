import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Siren } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { getSessionContext } from "@/lib/auth/session";
import { homeForRole, safeRedirectPath } from "@/lib/auth/roles";
import { DEMO_MODE } from "@/lib/supabase/env";
import { DEMO_ACCOUNTS } from "@/lib/auth/demo-accounts";
import { smsDeliveryMode } from "@/lib/services/sms-delivery";
import { LoginPanel } from "./login-panel";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/auth/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  const session = await getSessionContext();
  if (session.userId && !session.isAnonymous) {
    redirect(safeRedirectPath(next, homeForRole(session.role)));
  }

  const demoAccounts = DEMO_MODE
    ? Object.entries(DEMO_ACCOUNTS).map(([key, a]) => ({
        key,
        label: a.label,
        description: a.description,
      }))
    : [];

  return (
    <div className="flex min-h-dvh flex-col bg-navy">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" aria-label="JalSuraksha home">
          <Logo inverted />
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="size-4" /> Home
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pt-4 pb-10 sm:items-center">
        <div className="w-full max-w-md">
          <Link
            href="/citizen/sos"
            className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-danger px-5 py-4 font-semibold text-white shadow-lg shadow-red-950/40 transition hover:bg-danger/90"
          >
            <span className="flex items-center gap-3">
              <Siren className="size-6" aria-hidden />
              <span>
                In danger now?
                <span className="block text-sm font-normal text-white">
                  Send SOS without signing in
                </span>
              </span>
            </span>
            <span className="label-caps rounded-md bg-black/20 px-2 py-1">SOS</span>
          </Link>

          <LoginPanel next={next} demoAccounts={demoAccounts} demoMode={DEMO_MODE} smsMode={smsDeliveryMode(process.env)} />
        </div>
      </main>
    </div>
  );
}
