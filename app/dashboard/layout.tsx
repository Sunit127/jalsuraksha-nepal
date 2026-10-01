import type { Metadata } from "next";
import { OpsDataProvider } from "@/components/dashboard/ops-data";
import { OpsShell } from "@/components/dashboard/ops-shell";
import { AccessDenied } from "@/components/shared/access-denied";
import { requireArea } from "@/lib/auth/session";
import { DEMO_MODE } from "@/lib/supabase/env";
import { getOpsSnapshot } from "@/lib/supabase/ops-queries";

export const metadata: Metadata = {
  // Keep the site suffix for staff pages that set their own title.
  title: { default: "Emergency Operations Centre", template: "%s · JalSuraksha Nepal" },
};

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const auth = await requireArea("dashboard", "/dashboard");
  if (!auth.ok) return <AccessDenied area="Emergency Operations Centre" role={auth.session.role} />;

  const snapshot = await getOpsSnapshot();
  const { profile, role, email } = auth.session;
  return (
    <OpsDataProvider initial={snapshot}>
      <OpsShell role={role} name={profile?.full_name ?? email ?? "Operator"} demoMode={DEMO_MODE}>
        {children}
      </OpsShell>
    </OpsDataProvider>
  );
}
