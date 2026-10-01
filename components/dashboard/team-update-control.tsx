"use client";

import { useTransition } from "react";
import { Loader2, RadioTower } from "lucide-react";
import { toast } from "sonner";
import { recordTeamUpdate } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { RESCUE_NEXT_ACTION } from "@/lib/utilities/status";
import type { AssignmentStatus, RescueAssignment } from "@/types/domain";

/** Operator wording for the step the team reports next. */
const REPORTED_LABEL: Partial<Record<AssignmentStatus, string>> = {
  accepted: "Team accepted the mission",
  en_route: "Team is en route",
  arrived: "Team arrived on scene",
  in_progress: "Rescue in progress",
  completed: "Rescue completed",
};

/**
 * Lets the control centre record a team's progress when the team reports by
 * radio or phone rather than through the rescue console. Only the next valid
 * step is offered; the database re-checks every transition.
 */
export function TeamUpdateControl({ assignment, callSign }: { assignment: RescueAssignment; callSign: string }) {
  const [pending, startTransition] = useTransition();
  const next = RESCUE_NEXT_ACTION[assignment.status];
  if (!next) return null;
  const label = REPORTED_LABEL[next.to] ?? next.label;

  function record() {
    if (!next) return;
    startTransition(async () => {
      const res = await recordTeamUpdate({ assignmentId: assignment.id, status: next.to });
      if (res.ok) toast.success(res.message ?? "Recorded");
      else toast.error(res.error);
    });
  }

  return (
    <div className="mt-2 grid gap-2 rounded-lg border border-dashed p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold">
        <RadioTower className="size-3.5" aria-hidden /> Team update by radio / phone
      </p>
      <p className="text-xs text-muted-foreground">
        Team {callSign} updates this from the rescue console. If they report by radio or phone instead, record their
        next step here.
      </p>
      <Button type="button" size="sm" variant="outline" onClick={record} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <RadioTower />}
        Record: {label}
      </Button>
    </div>
  );
}
