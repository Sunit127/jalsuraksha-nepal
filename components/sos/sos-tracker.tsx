"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Info,
  LifeBuoy,
  Loader2,
  Phone,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PriorityBadge, SosStatusBadge } from "@/components/shared/status-badges";
import { RescueTeamMap, type SafeHospital, type SafeShelter, type TeamLocation } from "@/components/sos/rescue-team-map";
import { SafePlaces } from "@/components/sos/safe-places";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EMERGENCY_CONTACTS, SAFETY_INSTRUCTIONS } from "@/lib/demo/scenario";
import { PRIORITY_DISCLAIMER, SITUATION_LABEL, type PriorityFactor } from "@/lib/risk-engine/sos-priority";
import { getSupabaseBrowserClient, prepareRealtime } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatClock, timeAgo } from "@/lib/utilities/format";
import { tokenForRef } from "@/lib/utilities/my-sos";
import { ASSIGNMENT_STATUS_LABEL, CITIZEN_TIMELINE, isSosOpen } from "@/lib/utilities/status";
import { cn } from "@/lib/utils";
import type { AssignmentStatus, PriorityLevel, SosSituation, SosStatus } from "@/types/domain";

type TrackResponse = {
  sos: {
    id: string;
    reference_code: string;
    status: SosStatus;
    priority_score: number;
    priority_level: PriorityLevel;
    priority_factors: PriorityFactor[];
    operator_priority_override: PriorityLevel | null;
    effective_priority: PriorityLevel;
    people_count: number;
    children_count: number;
    elderly_count: number;
    injured: boolean;
    situation: SosSituation;
    location_name: string | null;
    latitude: number;
    longitude: number;
    created_at: string;
  };
  history: { to_status: SosStatus; note: string | null; created_at: string }[];
  assignment: {
    status: AssignmentStatus;
    assigned_at: string;
    en_route_at: string | null;
    arrived_at: string | null;
    rescue_teams: { call_sign: string; name: string; personnel_count: number; equipment: string[]; contact_phone: string | null } | null;
  } | null;
  /** Assigned team's live GPS position (only during an active mission). */
  teamLocation: TeamLocation | null;
  safePlaces: { shelters: SafeShelter[]; hospitals: SafeHospital[] };
  fetchedAt: string;
};

const POLL_MS = 6000;

/** First time each timeline step was reached, from the status history. */
function stepTimes(history: TrackResponse["history"]) {
  const times: Record<string, string> = {};
  for (const step of CITIZEN_TIMELINE) {
    const hit = history.find((h) => step.reachedBy.includes(h.to_status));
    if (hit) times[step.key] = hit.created_at;
  }
  return times;
}

export function SosTracker({ reference, tokenFromUrl }: { reference: string; tokenFromUrl: string | null }) {
  const [token, setToken] = useState<string | null>(tokenFromUrl);
  const [data, setData] = useState<TrackResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const lastStatus = useRef<SosStatus | null>(null);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- token may only exist in browser storage
    if (!tokenFromUrl) setToken(tokenForRef(reference));
  }, [reference, tokenFromUrl]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/sos/track?ref=${encodeURIComponent(reference)}&token=${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setError(res.status === 404 ? "We could not find this SOS on this device." : "Status temporarily unavailable — retrying…");
        return;
      }
      const json = (await res.json()) as TrackResponse;
      setError(null);
      setData(json);
      const prev = lastStatus.current;
      if (prev && prev !== json.sos.status) {
        const team = json.assignment?.rescue_teams?.call_sign;
        const msg =
          json.sos.status === "assigned" || json.sos.status === "accepted"
            ? `Rescue team ${team ?? ""} assigned`
            : json.sos.status === "en_route"
              ? `Rescue Team ${team ?? ""} dispatched`
              : json.sos.status === "arrived"
                ? `Rescue Team ${team ?? ""} has arrived`
                : json.sos.status === "resolved"
                  ? "Rescue completed"
                  : json.sos.status === "acknowledged"
                    ? "Control centre has your SOS"
                    : null;
        if (msg) {
          toast.success(msg);
          setAnnounce(msg);
          if ("vibrate" in navigator) navigator.vibrate?.(120);
        }
      }
      lastStatus.current = json.sos.status;
    } catch {
      setError("Connection lost — retrying…");
    }
  }, [reference, token]);

  // Initial load + polling fallback.
  useEffect(() => {
    if (!token) return;
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [token, load]);

  // Realtime: instant updates when this device's session owns the SOS.
  const sosId = data?.sos.id;
  useEffect(() => {
    if (!sosId || !isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowserClient();
    const refresh = () => void load();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void prepareRealtime().then(async () => {
      // Without a session RLS hides this SOS from Realtime; rely on polling
      // and don't claim to be "live".
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session) return;
      channel = supabase
      .channel(`sos-track:${sosId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sos_requests", filter: `id=eq.${sosId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "rescue_assignments", filter: `sos_id=eq.${sosId}` }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "incident_status_history", filter: `sos_id=eq.${sosId}` }, refresh)
      // RLS only delivers the position of the team assigned to this SOS.
      .on("postgres_changes", { event: "*", schema: "public", table: "team_locations" }, refresh)
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    });
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [sosId, load]);

  async function markSafe() {
    if (!token) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/sos/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: reference, token }),
      });
      if (!res.ok) throw new Error();
      toast.success("Marked safe. The control centre has been informed.");
      await load();
    } catch {
      toast.error("Could not update your SOS. Please try again or call 100.");
    } finally {
      setCancelling(false);
    }
  }

  if (!token) {
    return (
      <Alert variant="warning">
        <AlertTitle>Tracking link incomplete</AlertTitle>
        <AlertDescription>
          This device does not have the tracking code for {reference}. Your request is still with the
          control centre. Open the link shown right after sending, or call 100.
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return error ? (
      <Alert variant="destructive">
        <AlertTitle>{reference}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    ) : (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> Loading SOS status…
      </div>
    );
  }

  const { sos, assignment, history } = data;
  const times = stepTimes(history);
  const closed = !isSosOpen(sos.status);
  const cancelled = sos.status === "cancelled";
  const team = assignment?.status !== "cancelled" ? assignment?.rescue_teams : null;

  return (
    <div className="grid gap-4">
      <p aria-live="polite" className="sr-only">{announce}</p>

      <section
        className={cn(
          "rounded-2xl p-5 text-white shadow-md",
          sos.status === "resolved" ? "bg-safe-strong" : cancelled ? "bg-slate-600" : "bg-danger",
        )}
      >
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-white/20">
            {sos.status === "resolved" || cancelled ? <ShieldCheck className="size-7" aria-hidden /> : <CheckCircle2 className="size-7" aria-hidden />}
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {sos.status === "resolved" ? "RESCUE COMPLETED" : cancelled ? "SOS CLOSED" : "SOS SENT"}
            </h1>
            <p className="text-sm text-white">
              {cancelled ? "You reported that you are safe." : `Sent ${timeAgo(sos.created_at)} · ${formatClock(sos.created_at)} NPT`}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-black/15 p-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white">Emergency reference</p>
            <p className="whitespace-nowrap text-lg font-bold tabular sm:text-xl" data-testid="sos-reference">{sos.reference_code}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white">Current priority</p>
            <p className="text-xl font-bold" data-testid="sos-priority">{sos.effective_priority.toUpperCase()}</p>
          </div>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white">
          <span className={cn("size-1.5 rounded-full", live ? "bg-emerald-300" : "bg-white/60")} />
          {live ? "Live updates connected" : `Updating every ${POLL_MS / 1000} s`}
          {error && ` · ${error}`}
        </p>
      </section>

      {team && !closed && (
        <section className="rounded-2xl border-2 border-info bg-info-soft p-4 text-info-ink" data-testid="team-card">
          <p className="label-caps">Rescue team assigned</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xl font-bold">
              <Truck className="size-6" aria-hidden /> Team {team.call_sign}
            </p>
            <span className="rounded-lg bg-info px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
              {ASSIGNMENT_STATUS_LABEL[assignment!.status]}
            </span>
          </div>
          <p className="mt-1 text-sm">
            {team.name} · {team.personnel_count} personnel · {team.equipment.join(", ")}
          </p>
          <p className="mt-2 text-sm font-medium">
            {assignment!.status === "en_route"
              ? `Rescue Team ${team.call_sign} dispatched — stay where you are and make yourself visible.`
              : assignment!.status === "arrived" || assignment!.status === "in_progress"
                ? `Rescue Team ${team.call_sign} has arrived. Follow the team's instructions.`
                : "The team is preparing to leave."}
          </p>
        </section>
      )}

      {team && !closed && (
        <RescueTeamMap
          you={{ lat: sos.latitude, lng: sos.longitude }}
          team={team}
          status={assignment!.status}
          location={data.teamLocation ?? null}
          shelters={data.safePlaces?.shelters ?? []}
          hospitals={data.safePlaces?.hospitals ?? []}
        />
      )}

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Status</h2>
        <ol className="mt-3 grid gap-0" aria-label="SOS status timeline">
          {CITIZEN_TIMELINE.map((step, i) => {
            const reached = Boolean(times[step.key]) || step.reachedBy.includes(sos.status);
            const current =
              reached && !CITIZEN_TIMELINE.slice(i + 1).some((s) => s.reachedBy.includes(sos.status));
            return (
              <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
                {i < CITIZEN_TIMELINE.length - 1 && (
                  <span
                    className={cn("absolute top-6 left-[11px] h-[calc(100%-1rem)] w-0.5", reached ? "bg-safe" : "bg-border")}
                    aria-hidden
                  />
                )}
                <span className="relative z-10 mt-0.5">
                  {reached ? (
                    <CheckCircle2 className={cn("size-6 text-safe", current && !closed && "animate-pulse")} aria-hidden />
                  ) : (
                    <Circle className="size-6 text-border" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-semibold", !reached && "text-muted-foreground")}>
                    {step.label}
                    {step.key === "assigned" && team && reached && ` — Team ${team.call_sign}`}
                    <span className="sr-only">{reached ? " (done)" : " (pending)"}</span>
                  </p>
                  {times[step.key] && (
                    <p className="text-xs text-muted-foreground">{formatClock(times[step.key])} NPT</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {cancelled && <p className="mt-3 text-sm text-muted-foreground">Closed — you reported you are safe.</p>}
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Priority recommendation</h2>
          <PriorityBadge level={sos.effective_priority} overridden={Boolean(sos.operator_priority_override)} />
        </div>
        <ul className="mt-2 grid gap-1 text-sm">
          {sos.priority_factors.map((f) => (
            <li key={f.label} className="flex justify-between gap-3">
              <span>{f.label}</span>
              <span className="font-semibold tabular">+{f.points}</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 border-t pt-1 font-semibold">
            <span>Score</span>
            <span className="tabular">{sos.priority_score}</span>
          </li>
        </ul>
        {sos.operator_priority_override && (
          <p className="mt-2 text-xs text-muted-foreground">Priority reviewed and set by the control centre.</p>
        )}
        <p className="mt-3 flex gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {PRIORITY_DISCLAIMER}
        </p>
      </section>

      <section className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl border bg-card p-2">
          <Users className="mx-auto size-4 text-muted-foreground" aria-hidden />
          <p className="mt-1 text-lg font-bold tabular">{sos.people_count}</p>
          <p className="text-muted-foreground">people</p>
        </div>
        <div className="rounded-xl border bg-card p-2">
          <p className="text-lg font-bold tabular">{sos.children_count}/{sos.elderly_count}</p>
          <p className="text-muted-foreground">children / elderly</p>
        </div>
        <div className="rounded-xl border bg-card p-2">
          <p className="text-sm font-bold">{sos.injured ? "Injured" : "No injury"}</p>
          <p className="text-muted-foreground">{SITUATION_LABEL[sos.situation]}</p>
        </div>
      </section>

      {!closed && (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <LifeBuoy className="size-4" aria-hidden /> While you wait
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/85">
            {SAFETY_INSTRUCTIONS.slice(0, 4).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {!closed && <SafePlaces shelters={data.safePlaces?.shelters ?? []} hospitals={data.safePlaces?.hospitals ?? []} />}

      <div className="grid grid-cols-3 gap-2">
        {EMERGENCY_CONTACTS.map((c) => (
          <Button key={c.number} asChild variant="outline" className="h-auto flex-col py-2">
            <a href={`tel:${c.number}`}>
              <span className="flex items-center gap-1 text-base font-bold"><Phone className="size-4" aria-hidden />{c.number}</span>
              <span className="text-[11px] font-normal text-muted-foreground">{c.name}</span>
            </a>
          </Button>
        ))}
      </div>

      {!closed && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="safe" size="lg" className="w-full">
              <ShieldCheck /> I am safe now
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark yourself safe?</DialogTitle>
              <DialogDescription>
                This closes {sos.reference_code} and frees the rescue team for other people. Only do this if
                everyone in your group is safe.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Keep SOS open</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="safe" onClick={markSafe} disabled={cancelling}>
                  {cancelling ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Yes, we are safe
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <SosStatusBadge status={sos.status} />
        <Link href="/citizen/route" className="font-semibold text-primary">Find safe route →</Link>
      </div>
    </div>
  );
}
