"use client";

import Link from "next/link";
import { Baby, Clock3, Eye, HeartPulse, MapPin, PersonStanding, Users } from "lucide-react";
import { PriorityBadge, PRIORITY_DOT, SosStatusBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { SITUATION_LABEL } from "@/lib/risk-engine/sos-priority";
import type { StaffSos } from "@/lib/supabase/ops-queries";
import { formatClock, timeAgo } from "@/lib/utilities/format";
import { isSosOpen } from "@/lib/utilities/status";
import { cn } from "@/lib/utils";
import { AssignTeamDialog } from "./assign-team-dialog";
import { PriorityDialog } from "./priority-dialog";
import { ResolveDialog } from "./resolve-dialog";
import { useOpsData } from "./ops-data";

export function IncidentCard({
  sos,
  selected,
  onSelect,
}: {
  sos: StaffSos;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const { teamById, newIds } = useOpsData();
  const level = sos.effective_priority ?? sos.priority_level;
  const team = sos.assigned_team_id ? teamById.get(sos.assigned_team_id) : undefined;
  const open = isSosOpen(sos.status);
  const awaiting = sos.status === "received" || sos.status === "acknowledged";

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-3 pl-4 shadow-xs transition",
        selected && "ring-2 ring-primary",
        newIds.has(sos.id) && "animate-in fade-in slide-in-from-top-2 border-danger bg-danger-soft/40",
      )}
      data-testid={`incident-${sos.reference_code}`}
      aria-label={`Incident ${sos.reference_code}, ${level} priority`}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1.5", PRIORITY_DOT[level])} aria-hidden />
      <button type="button" onClick={onSelect} className="block w-full cursor-pointer text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold tabular">
              {sos.reference_code}
              {(newIds.has(sos.id) || sos.status === "received") && (
                <span className="rounded bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white" title="Not yet opened by an operator">NEW</span>
              )}
            </p>
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" aria-hidden />
              {sos.location_name ?? `${sos.latitude.toFixed(4)}, ${sos.longitude.toFixed(4)}`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <PriorityBadge level={level} overridden={Boolean(sos.operator_priority_override)} />
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground" title={formatClock(sos.created_at)}>
              <Clock3 className="size-3" aria-hidden /> {timeAgo(sos.created_at)}
            </span>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="flex items-center gap-1"><Users className="size-3.5 text-muted-foreground" aria-hidden />{sos.people_count} people</span>
          {sos.children_count > 0 && (
            <span className="flex items-center gap-1"><Baby className="size-3.5 text-muted-foreground" aria-hidden />{sos.children_count} children</span>
          )}
          {sos.elderly_count > 0 && (
            <span className="flex items-center gap-1"><PersonStanding className="size-3.5 text-muted-foreground" aria-hidden />{sos.elderly_count} elderly</span>
          )}
          {sos.injured && (
            <span className="flex items-center gap-1 font-semibold text-danger-ink"><HeartPulse className="size-3.5" aria-hidden />Injured</span>
          )}
        </div>
        <p className="mt-1 text-xs font-medium">{SITUATION_LABEL[sos.situation]}</p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <SosStatusBadge status={sos.status} />
          {team && <span className="text-xs font-semibold">Team {team.call_sign}</span>}
        </div>
      </button>

      <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-2">
        <Button asChild size="sm" variant="outline">
          <Link href={`/dashboard/incidents/${sos.id}`}>
            <Eye /> View Incident
          </Link>
        </Button>
        {open && (awaiting || sos.status === "assigned" || sos.status === "accepted") && <AssignTeamDialog sos={sos} />}
        {open && <PriorityDialog sos={sos} />}
        {open && <ResolveDialog sos={sos} />}
      </div>
    </article>
  );
}
