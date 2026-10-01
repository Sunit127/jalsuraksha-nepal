"use client";

import { useState, useTransition } from "react";
import { Gauge, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { overridePriority } from "@/app/dashboard/actions";
import { PriorityBadge } from "@/components/shared/status-badges";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PRIORITY_DISCLAIMER } from "@/lib/risk-engine/sos-priority";
import type { StaffSos } from "@/lib/supabase/ops-queries";
import { cn } from "@/lib/utils";
import type { PriorityLevel } from "@/types/domain";

const LEVELS: PriorityLevel[] = ["critical", "high", "moderate", "low"];

export function PriorityDialog({ sos, trigger }: { sos: StaffSos; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<PriorityLevel>(sos.effective_priority ?? sos.priority_level);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function save(clear = false) {
    startTransition(async () => {
      const res = await overridePriority({ sosId: sos.id, level: clear ? null : level, note: note || undefined });
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
        setNote("");
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Gauge /> Change Priority
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change priority — {sos.reference_code}</DialogTitle>
          <DialogDescription>
            Automated recommendation: <strong>{sos.priority_level.toUpperCase()}</strong> (score {sos.priority_score}).
            Operators make the final decision.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Priority level">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={level === l}
              onClick={() => setLevel(l)}
              className={cn(
                "flex cursor-pointer items-center justify-between rounded-xl border p-3 transition",
                level === l ? "border-primary ring-2 ring-primary" : "hover:bg-accent",
              )}
            >
              <PriorityBadge level={l} />
              {l === sos.priority_level && <span className="text-[11px] text-muted-foreground">recommended</span>}
            </button>
          ))}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="override-note">Reason (recorded in the incident log)</Label>
          <Textarea
            id="override-note"
            rows={2}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Caller confirmed wheelchair user, water at chest height"
          />
        </div>
        <p className="text-xs text-muted-foreground">{PRIORITY_DISCLAIMER}</p>
        <DialogFooter>
          {sos.operator_priority_override && (
            <Button variant="ghost" onClick={() => save(true)} disabled={pending}>
              Use recommendation
            </Button>
          )}
          <Button onClick={() => save(false)} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />} Save priority
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
