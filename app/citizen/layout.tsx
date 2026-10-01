import type { Metadata } from "next";
import { CitizenDataProvider } from "@/components/shared/citizen-data";
import { CitizenShell } from "@/components/shared/citizen-shell";
import { getSessionContext } from "@/lib/auth/session";
import { DEMO_MODE } from "@/lib/supabase/env";
import { getPublicSnapshot } from "@/lib/supabase/queries";

export const metadata: Metadata = {
  // Keep the site suffix for citizen pages that set their own title.
  title: { default: "Citizen", template: "%s · JalSuraksha Nepal" },
};

export default async function CitizenLayout({ children }: LayoutProps<"/citizen">) {
  const [snapshot, session] = await Promise.all([getPublicSnapshot(), getSessionContext()]);

  return (
    <CitizenDataProvider
      initial={snapshot}
      demoMode={DEMO_MODE}
      session={{
        userId: session.userId,
        isAnonymous: session.isAnonymous,
        name: session.profile?.full_name ?? null,
        phone: session.isAnonymous ? null : (session.profile?.phone ?? null),
        role: session.role,
        safetyStatus: session.profile?.safety_status ?? null,
      }}
    >
      <CitizenShell>{children}</CitizenShell>
    </CitizenDataProvider>
  );
}
