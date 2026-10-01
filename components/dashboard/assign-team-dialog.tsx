"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Truck, Users, Wrench } from "lucide-react";
import { toast } from "sonner";
import { assignRescueTeam } from "@/app/dashboard/actions";
import { TeamStatusBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { StaffSos } from "@/lib/supabase/ops-queries";
import { formatDistance } from "@/lib/utilities/geo";
import { rankTeamsForIncident } from "@/lib/utilities/ops-metrics";
import { cn } from "@/lib/utils";
import { useOpsData } from "./ops-data";

export function AssignTeamDialog({
  sos,
  trigger,
}: {
  sos: StaffSos;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const { teams } = useOpsData();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ranked = rankTeamsForIncident(teams, { lat: sos.latitude, lng: sos.longitude });
  const reassign = Boolean(sos.assigned_team_id);

  function assign() {
    if (!selected) return;
    startTransition(async () => {
      const res = await assignRescueTeam({ sosId: sos.id, teamId: selected, expectedTeamId: sos.assigned_team_id });
      if (res.ok) {
        const team = teams.find((t) => t.id === selected);
        toast.success(`Team ${team?.call_sign ?? ""} assigned to ${sos.reference_code}`);
        setOpen(false);
        setSelected(null);
      } else {
        toast.error(res.error);
        // Pull fresh incident/team state so the operator decides on current data.
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Truck /> {reassign ? "Reassign team" : "Assign Rescue Team"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{reassign ? "Reassign" : "Assign"} rescue team — {sos.reference_code}</DialogTitle>
          <DialogDescription>
            {sos.people_count} people · {sos.location_name ?? "GPS location"}. Teams are sorted by availability,
            then straight-line distance.
          </DialogDescription>
        </DialogHeader>

        <ul className="grid max-h-[50dvh] gap-2 overflow-y-auto pr-1" role="radiogroup" aria-label="Rescue teams">
          {ranked.map((t) => {
            const available = t.status === "available";
            const isCurrent = t.id === sos.assigned_team_id;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected === t.id}
                  disabled={!available}
                  onClick={() => setSelected(t.id)}
                  data-testid={`team-option-${t.call_sign}`}
                  className={cn(
                    "flex w-full cursor-pointer items-start justify-between gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-55",
                    selected === t.id ? "border-primary bg-accent ring-2 ring-primary" : "hover:bg-accent",
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-semibold">
                      Rescue Team {t.call_sign}
                      {isCurrent && <span className="ml-2 text-xs font-normal text-muted-foreground">(current)</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{t.name}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="flex items-center gap-1"><Users className="size-3.5" aria-hidden /> {t.personnel_count} personnel</span>
                      <span className="flex items-center gap-1"><Wrench className="size-3.5" aria-hidden /> {t.equipment.join(", ")}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <TeamStatusBadge status={t.status} />
                    <span className="text-sm font-semibold tabular">{formatDistance(t.distanceM)}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        {ranked.every((t) => t.status !== "available") && (
          <p className="rounded-lg bg-high-soft p-3 text-sm text-high-ink">
            No rescue team is available right now. Keep the incident in the queue and reassign when a team finishes.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={assign} disabled={!selected || pending} data-testid="confirm-assign">
            {pending ? <Loader2 className="animate-spin" /> : <Truck />} ASSIGN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
