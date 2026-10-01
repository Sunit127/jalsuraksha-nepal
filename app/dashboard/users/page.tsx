import type { Metadata } from "next";
import { AccessDenied } from "@/components/shared/access-denied";
import { UsersTable } from "@/components/dashboard/users-table";
import { authorize } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Users & roles" };

export default async function UsersPage() {
  const auth = await authorize("admin");
  if (!auth.ok) return <AccessDenied area="user management" role={auth.session.role} />;

  const supabase = await createSupabaseServerClient();
  const [{ data: profiles }, { data: teams }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, phone, role, rescue_team_id, district, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("rescue_teams").select("id, call_sign, name").order("call_sign"),
  ]);

  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:p-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Users & roles</h1>
        <p className="text-sm text-muted-foreground">
          Roles are stored server-side and enforced by row-level security. Anonymous guest SOS sessions are listed as citizens without a name.
        </p>
      </div>
      <UsersTable users={profiles ?? []} teams={teams ?? []} currentUserId={auth.session.userId} />
    </div>
  );
}
