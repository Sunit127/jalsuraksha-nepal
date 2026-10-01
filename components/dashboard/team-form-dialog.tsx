"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTeam, saveTeam, type TeamInput } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RescueTeam } from "@/types/domain";

export type FireStation = { id: string; name: string; latitude: number; longitude: number; municipality: string | null };

/**
 * Admin form to add or edit a real rescue team. Base coordinates can be
 * typed or copied from a real fire station (BIPAD) in the pilot area.
 */
export function TeamFormDialog({ team, fireStations }: { team?: RescueTeam; fireStations: FireStation[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [form, setForm] = useState<TeamInput>(() => ({
    id: team?.id,
    callSign: team?.call_sign ?? "",
    name: team?.name ?? "",
    personnelCount: team?.personnel_count ?? 4,
    equipment: team?.equipment.join(", ") ?? "",
    contactPhone: team?.contact_phone ?? "",
    baseLocation: team?.base_location ?? "",
    latitude: team?.latitude ?? 27.6833,
    longitude: team?.longitude ?? 84.4333,
    district: team?.district ?? "Chitwan",
  }));
  const set = <K extends keyof TeamInput>(k: K, v: TeamInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () =>
    start(async () => {
      const res = await saveTeam(form);
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        setOpen(false);
      } else toast.error(res.error);
    });

  const remove = () =>
    start(async () => {
      if (!team) return;
      const res = await deleteTeam(team.id);
      if (res.ok) {
        toast.success(res.message ?? "Removed");
        setOpen(false);
      } else toast.error(res.error);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {team ? (
          <Button size="sm" variant="ghost" aria-label={`Edit team ${team.call_sign}`}>
            <Pencil /> Edit
          </Button>
        ) : (
          <Button size="sm">
            <Plus /> Add team
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{team ? `Edit team ${team.call_sign}` : "Add a rescue team"}</DialogTitle>
          <DialogDescription>
            Real teams appear in dispatch and on /rescue. New teams start offline; mark them available when they are on duty.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="t-call">Call sign</Label>
              <Input id="t-call" value={form.callSign} onChange={(e) => set("callSign", e.target.value)} placeholder="R-08" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-name">Team name</Label>
              <Input id="t-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Bharatpur Fire Brigade — Crew A" />
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="t-pers">Personnel</Label>
              <Input id="t-pers" type="number" min={1} value={form.personnelCount} onChange={(e) => set("personnelCount", Number(e.target.value))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-eq">Equipment (comma-separated)</Label>
              <Input id="t-eq" value={form.equipment} onChange={(e) => set("equipment", e.target.value)} placeholder="Boat, Life jackets, First Aid" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-phone">Contact phone</Label>
            <Input id="t-phone" value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} placeholder="98XXXXXXXX" />
          </div>
          {fireStations.length > 0 && (
            <div className="grid gap-1.5">
              <Label htmlFor="t-station">Base at a fire station (BIPAD)</Label>
              <select
                id="t-station"
                className="h-9 rounded-md border bg-background px-2 text-sm"
                defaultValue=""
                onChange={(e) => {
                  const st = fireStations.find((s) => s.id === e.target.value);
                  if (st)
                    setForm((f) => ({
                      ...f,
                      latitude: st.latitude,
                      longitude: st.longitude,
                      baseLocation: [st.name, st.municipality].filter(Boolean).join(", "),
                    }));
                }}
              >
                <option value="">— choose to copy its location —</option>
                {fireStations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.municipality ? ` (${s.municipality})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="t-base">Base location</Label>
            <Input id="t-base" value={form.baseLocation} onChange={(e) => set("baseLocation", e.target.value)} placeholder="Narayanghat, Bharatpur-10" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="t-lat">Latitude</Label>
              <Input id="t-lat" type="number" step="0.0001" value={form.latitude} onChange={(e) => set("latitude", Number(e.target.value))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-lng">Longitude</Label>
              <Input id="t-lng" type="number" step="0.0001" value={form.longitude} onChange={(e) => set("longitude", Number(e.target.value))} />
            </div>
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          {team ? (
            <Button variant="ghost" className="text-danger-ink" onClick={remove} disabled={pending}>
              <Trash2 /> Remove team
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />} Save team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
