"use client";

import { useState, useTransition } from "react";
import { Loader2, Minus, Plus, Save, ShieldCheck, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { dismissCandidateShelter, importShelterCsv, updateShelter, verifyShelter } from "@/app/dashboard/actions";
import { useOpsData } from "@/components/dashboard/ops-data";
import { capacityTone } from "@/components/shelter/shelter-card";
import { DemoBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { Shelter, SupplyStatus } from "@/types/domain";

type Tab = "open" | "closed" | "candidates";

export default function SheltersAdminPage({ isAdmin = false }: { isAdmin?: boolean }) {
  const { shelters } = useOpsData();
  const [tab, setTab] = useState<Tab>("open");
  const [query, setQuery] = useState("");
  const [municipality, setMunicipality] = useState("all");

  const open = shelters.filter((s) => s.is_active);
  const closed = shelters.filter((s) => !s.is_active && s.verification !== "unverified");
  const candidates = shelters.filter((s) => s.verification === "unverified");
  const totals = open.reduce((a, s) => ({ cap: a.cap + s.capacity, occ: a.occ + s.current_occupancy }), { cap: 0, occ: 0 });
  const municipalities = [...new Set(candidates.map((s) => s.municipality))].sort();
  const q = query.trim().toLowerCase();
  const filteredCandidates = candidates.filter(
    (s) => (municipality === "all" || s.municipality === municipality) && (!q || `${s.name} ${s.address}`.toLowerCase().includes(q)),
  );
  const list = tab === "open" ? open : tab === "closed" ? closed : filteredCandidates;

  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Shelter management</h1>
          <p className="text-sm text-muted-foreground">
            {totals.occ} people sheltered · {Math.max(totals.cap - totals.occ, 0)} spaces free across {open.length} open shelters.
            Changes reach citizens instantly.
          </p>
        </div>
        {isAdmin && <CsvImport />}
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Shelter lists">
        {(
          [
            ["open", `Open to citizens (${open.length})`],
            ["closed", `Closed (${closed.length})`],
            ["candidates", `Candidates to verify (${candidates.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn("cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium", tab === key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "candidates" && (
        <div className="grid gap-2 rounded-xl border bg-card p-3 text-sm">
          <p className="text-muted-foreground">
            Real schools and community buildings imported from the BIPAD portal and OpenStreetMap. They are <strong>not</strong> official
            shelters: confirm with the ward office that a building is safe and available, enter its capacity, then open it.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or ward…" className="h-9 max-w-xs" aria-label="Search candidates" />
            <Select value={municipality} onValueChange={setMunicipality}>
              <SelectTrigger className="h-9 w-64" aria-label="Filter by municipality">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All municipalities</SelectItem>
                {municipalities.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {tab === "open" ? "No shelters are open. Verify a candidate or re-open a closed shelter." : tab === "closed" ? "No closed shelters." : "No candidates match."}
        </p>
      ) : tab === "candidates" ? (
        <ul className="grid gap-2">
          {list.slice(0, 100).map((s) => (
            <CandidateRow key={s.id} shelter={s} isAdmin={isAdmin} />
          ))}
          {list.length > 100 && <li className="text-center text-xs text-muted-foreground">Showing 100 of {list.length} — refine the search.</li>}
        </ul>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((s) => (
            <ShelterEditor key={`${s.id}:${s.updated_at}`} shelter={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function CandidateRow({ shelter, isAdmin }: { shelter: Shelter; isAdmin: boolean }) {
  const [capacity, setCapacity] = useState("");
  const [pending, start] = useTransition();
  const verify = (open: boolean) =>
    start(async () => {
      const res = await verifyShelter({ shelterId: shelter.id, capacity: Number(capacity), open });
      if (res.ok) toast.success(`${shelter.name}: ${res.message}`);
      else toast.error(res.error);
    });
  const dismiss = () =>
    start(async () => {
      const res = await dismissCandidateShelter(shelter.id);
      if (res.ok) toast.success(res.message ?? "Removed");
      else toast.error(res.error);
    });
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
      <div className="min-w-0">
        <p className="font-medium">{shelter.name}</p>
        <p className="text-xs text-muted-foreground">
          {shelter.address} · {shelter.kind.replace("_", " ")} · source: {shelter.data_source}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="number"
          min={1}
          inputMode="numeric"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder="Capacity"
          className="h-8 w-28"
          aria-label={`Capacity of ${shelter.name}`}
        />
        <Button size="sm" disabled={pending || !(Number(capacity) > 0)} onClick={() => verify(true)}>
          {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Verify &amp; open
        </Button>
        <Button size="sm" variant="outline" disabled={pending || !(Number(capacity) > 0)} onClick={() => verify(false)}>
          Verify (keep closed)
        </Button>
        {isAdmin && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={dismiss} aria-label={`Not suitable: remove ${shelter.name}`}>
            <X /> Not suitable
          </Button>
        )}
      </div>
    </li>
  );
}

function CsvImport() {
  const [pending, start] = useTransition();
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent">
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
      Import official list (CSV)
      <input
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        disabled={pending}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          start(async () => {
            const res = await importShelterCsv(await file.text());
            if (res.ok) toast.success(res.message ?? "Imported");
            else toast.error(res.error);
          });
        }}
      />
    </label>
  );
}

function ShelterEditor({ shelter }: { shelter: Shelter }) {
  const [occupancy, setOccupancy] = useState(shelter.current_occupancy);
  const [food, setFood] = useState<SupplyStatus>(shelter.food_status);
  const [water, setWater] = useState<SupplyStatus>(shelter.water_status);
  const [medical, setMedical] = useState(shelter.medical_assistance);
  const [active, setActive] = useState(shelter.is_active);
  const [pending, startTransition] = useTransition();
  const dirty =
    occupancy !== shelter.current_occupancy ||
    food !== shelter.food_status ||
    water !== shelter.water_status ||
    medical !== shelter.medical_assistance ||
    active !== shelter.is_active;
  const remaining = Math.max(shelter.capacity - occupancy, 0);
  const tone = capacityTone(remaining, shelter.capacity);

  function save() {
    startTransition(async () => {
      const res = await updateShelter({
        shelterId: shelter.id,
        currentOccupancy: occupancy,
        foodStatus: food,
        waterStatus: water,
        medicalAssistance: medical,
        isActive: active,
      });
      if (res.ok) toast.success(`${shelter.name} updated`);
      else toast.error(res.error);
    });
  }

  return (
    <article className={cn("grid gap-3 rounded-xl border bg-card p-4", !active && "opacity-70")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold">{shelter.name}</h2>
          <p className="truncate text-xs text-muted-foreground">{shelter.address} · {shelter.contact_phone}</p>
        </div>
        <div className="flex items-center gap-2">
          {shelter.is_demo && <DemoBadge label="DEMO" />}
          {shelter.verification === "verified" && !shelter.is_demo && (
            <span className="rounded bg-safe-soft px-1.5 py-0.5 text-[10px] font-bold text-safe-ink">VERIFIED</span>
          )}
          <span className={cn("text-xs font-bold", tone.text)}>{tone.label}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Occupancy</span>
        <Button type="button" variant="outline" size="icon-sm" aria-label="Decrease occupancy by 10" onClick={() => setOccupancy((o) => Math.max(0, o - 10))}>
          <Minus />
        </Button>
        <Input
          type="number"
          min={0}
          value={occupancy}
          onChange={(e) => setOccupancy(Math.max(0, Number.parseInt(e.target.value || "0", 10)))}
          className="h-8 w-24 text-center tabular"
          aria-label={`Current occupancy of ${shelter.name}`}
        />
        <Button type="button" variant="outline" size="icon-sm" aria-label="Increase occupancy by 10" onClick={() => setOccupancy((o) => o + 10)}>
          <Plus />
        </Button>
        <span className="text-sm text-muted-foreground tabular">/ {shelter.capacity} · {remaining} free</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className={cn("h-full", tone.bar)} style={{ width: `${Math.min(100, (occupancy / shelter.capacity) * 100)}%` }} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SupplySelect label="Food" value={food} onChange={setFood} />
        <SupplySelect label="Water" value={water} onChange={setWater} />
        <label className="flex items-center justify-between gap-2 rounded-lg border px-3 text-sm">
          Medical <Switch checked={medical} onCheckedChange={setMedical} aria-label="Medical assistance available" />
        </label>
        <label className="flex items-center justify-between gap-2 rounded-lg border px-3 text-sm">
          Open <Switch checked={active} onCheckedChange={setActive} aria-label="Shelter open" />
        </label>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={!dirty || pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />} Save changes
        </Button>
      </div>
    </article>
  );
}

function SupplySelect({ label, value, onChange }: { label: string; value: SupplyStatus; onChange: (v: SupplyStatus) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SupplyStatus)}>
      <SelectTrigger className="h-10 text-xs" aria-label={`${label} status`}>
        <span className="text-muted-foreground">{label}:</span> <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="available">Available</SelectItem>
        <SelectItem value="limited">Limited</SelectItem>
        <SelectItem value="unavailable">None</SelectItem>
      </SelectContent>
    </Select>
  );
}
