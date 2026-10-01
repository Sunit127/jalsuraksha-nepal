"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { resolveSos } from "@/app/dashboard/actions";
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
import type { StaffSos } from "@/lib/supabase/ops-queries";

export function ResolveDialog({ sos, trigger }: { sos: StaffSos; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function resolve() {
    startTransition(async () => {
      const res = await resolveSos(sos.id, note);
      if (res.ok) {
        toast.success(`${sos.reference_code} marked resolved`);
        setOpen(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="ghost">
            <CheckCircle2 /> Mark Resolved
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark {sos.reference_code} resolved?</DialogTitle>
          <DialogDescription>
            This closes the incident for the citizen and releases any assigned rescue team.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="resolve-note">Resolution note</Label>
          <Textarea
            id="resolve-note"
            rows={2}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Family evacuated by neighbours, confirmed by phone"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="safe" onClick={resolve} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Mark resolved
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
