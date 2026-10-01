import { RescueConsole } from "@/components/rescue/rescue-console";
import { RescueTeamsBoard } from "@/components/rescue/rescue-teams-board";
import { authorize } from "@/lib/auth/session";
import { ROLE_LABEL, isStaffRole } from "@/lib/auth/roles";
import { SOS_STAFF_COLUMNS, type StaffSos } from "@/lib/supabase/ops-queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

const hoursAgoIso = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString();

/**
 * Rescue console.
 *  - Rescue crew: their own team only (the ?team= parameter is ignored; RLS
 *    also limits them to their team's rows).
 *  - Staff (operator/admin): an "All teams" board, or ?team=<id> to open any
 *    team's console and record progress on its behalf.
 */
export default async function RescuePage({ searchParams }: PageProps<"/rescue">) {
  const auth = await authorize("rescue");
  if (!auth.ok) return null; // layout already rendered the access state

  const params = await searchParams;
  const staff = isStaffRole(auth.session.role);
  const userName = auth.session.profile?.full_name ?? null;
  const ownTeam = auth.session.profile?.rescue_team_id ?? null;
  const requested = uuidSchema.safeParse(typeof params.team === "string" ? params.team : "");
  const teamId = staff ? (requested.success ? requested.data : ownTeam) : ownTeam;
  const supabase = await createSupabaseServerClient();

  if (staff && !teamId) {
    const [{ data: teams }, { data: assignments }] = await Promise.all([
      supabase.from("rescue_teams").select("*").order("call_sign"),
      supabase
        .from("rescue_assignments")
        .select("*")
        .not("status", "in", "(completed,cancelled)")
        .order("assigned_at", { ascending: false }),
    ]);
    const sosIds = [...new Set((assignments ?? []).map((a) => a.sos_id))];
    const { data: incidents } = sosIds.length
      ? await supabase.from("sos_requests").select(SOS_STAFF_COLUMNS).in("id", sosIds)
      : { data: [] };
    return (
      <RescueTeamsBoard
        teams={teams ?? []}
        assignments={assignments ?? []}
        incidents={(incidents as StaffSos[] | null) ?? []}
        userName={userName}
        roleLabel={ROLE_LABEL[auth.session.role]}
      />
    );
  }

  if (!teamId) {
    return <RescueConsole teamId={null} team={null} assignments={[]} incidents={[]} userName={userName} />;
  }

  const since = hoursAgoIso(24);
  const [{ data: team }, { data: assignments }, { data: hospitalRows }] = await Promise.all([
    supabase.from("rescue_teams").select("*").eq("id", teamId).maybeSingle(),
    supabase
      .from("rescue_assignments")
      .select("*")
      .eq("rescue_team_id", teamId)
      .or(`status.not.in.(completed,cancelled),assigned_at.gte.${since}`)
      .order("assigned_at", { ascending: false })
      .limit(30),
    supabase.from("facilities").select("id, name, latitude, longitude, phone").eq("kind", "hospital"),
  ]);

  const sosIds = [...new Set((assignments ?? []).map((a) => a.sos_id))];
  const { data: incidents } = sosIds.length
    ? await supabase.from("sos_requests").select(SOS_STAFF_COLUMNS).in("id", sosIds)
    : { data: [] };

  return (
    <RescueConsole
      teamId={teamId}
      team={team ?? null}
      assignments={assignments ?? []}
      incidents={(incidents as StaffSos[] | null) ?? []}
      userName={userName}
      staffView={staff ? { roleLabel: ROLE_LABEL[auth.session.role] } : null}
      hospitals={(hospitalRows ?? []).map((h) => ({ id: h.id, name: h.name, latitude: h.latitude, longitude: h.longitude, phone: h.phone ?? undefined }))}
    />
  );
}
