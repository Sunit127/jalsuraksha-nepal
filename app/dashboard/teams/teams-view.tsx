"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Phone, Users, Wrench } from "lucide-react";
import { toast } from "sonner";
import { setTeamStatus } from "@/app/dashboard/actions";
import { useOpsData } from "@/components/dashboard/ops-data";
import { TeamFormDialog, type FireStation } from "@/components/dashboard/team-form-dialog";
import { AssignmentStatusBadge, DemoBadge, TeamStatusBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { formatPhone, timeAgo } from "@/lib/utilities/format";
import { isAssignmentActive } from "@/lib/utilities/status";
import type { RescueTeam } from "@/types/domain";

export default function TeamsPage({ isAdmin = false, fireStations = [] }: { isAdmin?: boolean; fireStations?: FireStation[] }) {
  const { teams, assignments, sos } = useOpsData();
  const demoCount = teams.filter((t) => t.is_demo).length;
  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Rescue teams</h1>
          <p className="text-sm text-muted-foreground">
            {teams.filter((t) => t.status === "available").length} of {teams.length} teams available for dispatch.
            {demoCount > 0 && ` ${demoCount} are demo teams — ${isAdmin ? "add your real teams and remove or keep these for drills." : "an administrator can replace them with real teams."}`}
          </p>
        </div>
        {isAdmin && <TeamFormDialog fireStations={fireStations} />}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {teams.map((t) => {
          const mission = assignments.find((a) => a.rescue_team_id === t.id && isAssignmentActive(a.status));
          const incident = mission ? sos.find((s) => s.id === mission.sos_id) : undefined;
          const done = assignments.filter((a) => a.rescue_team_id === t.id && a.status === "completed").length;
          return (
            <TeamCard
              key={t.id}
              team={t}
              mission={mission}
              incidentRef={incident?.reference_code}
              incidentId={incident?.id}
              done={done}
              editor={isAdmin ? <TeamFormDialog key={`${t.id}:${t.updated_at}`} team={t} fireStations={fireStations} /> : null}
            />
          );
        })}
      </div>
    </div>
  );
}

function TeamCard({
  team,
  mission,
  incidentRef,
  incidentId,
  done,
  editor,
}: {
  editor?: React.ReactNode;
  team: RescueTeam;
  mission?: { status: Parameters<typeof AssignmentStatusBadge>[0]["status"]; assigned_at: string };
  incidentRef?: string;
  incidentId?: string;
  done: number;
}) {
  const [pending, startTransition] = useTransition();
  const idle = team.status === "available" || team.status === "offline";
  const toggle = () =>
    startTransition(async () => {
      const res = await setTeamStatus(team.id, team.status === "available" ? "offline" : "available");
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });

  return (
    <article className="grid gap-2 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold">Team {team.call_sign}</p>
          <p className="text-xs text-muted-foreground">{team.name}</p>
        </div>
        <span className="flex items-center gap-1.5">
          {team.is_demo && <DemoBadge label="DEMO" />}
          <TeamStatusBadge status={team.status} />
        </span>
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <span className="flex items-center gap-1"><Users className="size-3.5" aria-hidden />{team.personnel_count} personnel</span>
        <span className="flex items-center gap-1"><Wrench className="size-3.5" aria-hidden />{team.equipment.join(", ")}</span>
      </p>
      <p className="text-xs text-muted-foreground">Base: {team.base_location} · {done} missions completed (24 h)</p>
      {mission && incidentRef ? (
        <Link href={`/dashboard/incidents/${incidentId}`} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm hover:bg-accent">
          <span>On <span className="font-semibold tabular">{incidentRef}</span> · {timeAgo(mission.assigned_at)}</span>
          <AssignmentStatusBadge status={mission.status} />
        </Link>
      ) : null}
      <div className="flex gap-2 border-t pt-2">
        {team.contact_phone && (
          <Button asChild size="sm" variant="outline">
            <a href={`tel:${team.contact_phone}`}><Phone /> {formatPhone(team.contact_phone)}</a>
          </Button>
        )}
        {idle && (
          <Button size="sm" variant="ghost" onClick={toggle} disabled={pending}>
            {team.status === "available" ? "Mark offline" : "Mark available"}
          </Button>
        )}
        {editor}
      </div>
    </article>
  );
}
