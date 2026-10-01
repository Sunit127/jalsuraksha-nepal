"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Baby,
  CheckCircle2,
  HeartPulse,
  LayoutGrid,
  Loader2,
  LogOut,
  MapPin,
  MessageSquareText,
  Navigation,
  PersonStanding,
  Phone,
  Radio,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { signOut } from "@/app/auth/actions";
import { recordTeamUpdate, setTeamStatus } from "@/app/dashboard/actions";
import { setAvailability, updateMissionStatus } from "@/app/rescue/actions";
import { LiveMap } from "@/components/map";
import { LocationShare } from "@/components/rescue/location-share";
import { DesktopAlertsToggle } from "@/components/shared/desktop-alerts-toggle";
import { LogoMark } from "@/components/shared/logo";
import { AssignmentStatusBadge, PriorityBadge, TeamStatusBadge } from "@/components/shared/status-badges";
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
import { Switch } from "@/components/ui/switch";
import { SITUATION_LABEL } from "@/lib/risk-engine/sos-priority";
import type { StaffSos } from "@/lib/supabase/ops-queries";
import { getSupabaseBrowserClient, prepareRealtime } from "@/lib/supabase/client";
import { useResync } from "@/lib/supabase/use-realtime-rows";
import { showDesktopAlert } from "@/lib/utilities/desktop-alerts";
import { formatClock, formatPhone, timeAgo } from "@/lib/utilities/format";
import { formatDistance, haversineMeters } from "@/lib/utilities/geo";
import { ASSIGNMENT_STATUS_LABEL, RESCUE_NEXT_ACTION, isAssignmentActive } from "@/lib/utilities/status";
import { cn } from "@/lib/utils";
import type { Hospital, RescueAssignment, RescueTeam } from "@/types/domain";

const STEPS: { status: RescueAssignment["status"]; label: string }[] = [
  { status: "assigned", label: "Assigned" },
  { status: "accepted", label: "Accepted" },
  { status: "en_route", label: "En route" },
  { status: "arrived", label: "Arrived" },
  { status: "in_progress", label: "Rescue" },
  { status: "completed", label: "Completed" },
];

export function RescueConsole({
  teamId,
  team,
  assignments,
  incidents,
  userName,
  staffView = null,
  hospitals = [],
}: {
  teamId: string | null;
  team: RescueTeam | null;
  assignments: RescueAssignment[];
  incidents: StaffSos[];
  userName: string | null;
  /** Set when an operator/admin views a team's console on its behalf. */
  staffView?: { roleLabel: string } | null;
  /** Real hospitals in the pilot area (BIPAD), for the mission map. */
  hospitals?: Hospital[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [live, setLive] = useState(false);
  const resync = useResync();
  // Status confirmed by the server but not yet reflected in props (avoids a
  // stale button being tapped twice while router.refresh() is in flight).
  const [optimistic, setOptimistic] = useState<{ id: string; status: RescueAssignment["status"] } | null>(null);
  const knownActive = useRef(new Set(assignments.filter((a) => isAssignmentActive(a.status)).map((a) => a.id)));
  // Missions active at the last render, missions this team closed itself, and
  // the SOS reference of each mission (the SOS may stop being readable once
  // the mission ends), to explain a mission that disappears.
  const prevActive = useRef(new Set(assignments.filter((a) => isAssignmentActive(a.status)).map((a) => a.id)));
  const selfClosed = useRef(new Set<string>());
  const referenceOf = useRef(new Map<string, string>());
  useEffect(() => {
    for (const a of assignments) {
      const ref = incidents.find((s) => s.id === a.sos_id)?.reference_code;
      if (ref) referenceOf.current.set(a.id, ref);
    }
    const nowActive = new Set(assignments.filter((a) => isAssignmentActive(a.status)).map((a) => a.id));
    for (const id of prevActive.current) {
      if (nowActive.has(id) || selfClosed.current.has(id)) continue;
      const a = assignments.find((x) => x.id === id);
      if (!a) continue;
      const ref = referenceOf.current.get(id) ?? "Mission";
      const citizenSafe = a.status === "cancelled" && Boolean(a.notes?.includes("Citizen reported safe"));
      const title = citizenSafe
        ? `MISSION CANCELLED — ${ref}: the citizen reports they are SAFE`
        : a.status === "cancelled"
          ? `MISSION CLOSED — ${ref} was reassigned by the Operations Centre`
          : `MISSION CLOSED — ${ref} was resolved by the Operations Centre`;
      const body = "Stand down from this mission. Your team is available for new assignments.";
      if (citizenSafe) toast.success(title, { description: body, duration: 15_000 });
      else toast.info(title, { description: body, duration: 15_000 });
      if ("vibrate" in navigator) navigator.vibrate?.([100, 60, 100]);
      showDesktopAlert({ title, body, tag: `mission-closed:${id}`, urgent: true });
    }
    prevActive.current = nowActive;
  }, [assignments, incidents]);

  // Realtime: any change to this team's assignments (or the incidents they
  // cover) re-fetches the server data.
  useEffect(() => {
    if (!teamId) return;
    const supabase = getSupabaseBrowserClient();
    const refresh = () => router.refresh();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void prepareRealtime().then(() => {
      if (cancelled) return;
      channel = supabase
      .channel(`rescue:${teamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rescue_assignments", filter: `rescue_team_id=eq.${teamId}` }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rescue_teams", filter: `id=eq.${teamId}` }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sos_requests" }, refresh)
      .subscribe((s) => {
        setLive(s === "SUBSCRIBED");
        // (Re)joined: fetch anything missed while disconnected / locked.
        if (s === "SUBSCRIBED") resync();
      });
    });
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [teamId, router, resync]);

  const serverActive = assignments.find((a) => isAssignmentActive(a.status)) ?? null;
  const pendingStatus =
    optimistic && serverActive && optimistic.id === serverActive.id && optimistic.status !== serverActive.status
      ? optimistic.status
      : null;
  const active =
    serverActive && pendingStatus
      ? isAssignmentActive(pendingStatus)
        ? { ...serverActive, status: pendingStatus }
        : null
      : serverActive;
  const incident = active ? incidents.find((s) => s.id === active.sos_id) ?? null : null;
  const history = assignments.filter((a) => !isAssignmentActive(a.status));

  // Alert the team when a brand-new mission arrives.
  const activeId = active?.id;
  useEffect(() => {
    if (activeId && !knownActive.current.has(activeId)) {
      knownActive.current.add(activeId);
      toast.error(`NEW MISSION — ${incident?.reference_code ?? "incident"}`, { duration: 10_000 });
      if ("vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
      showDesktopAlert({
        title: `NEW MISSION — ${incident?.reference_code ?? "incident"}`,
        body: incident
          ? [`${incident.people_count} people · ${incident.location_name ?? "GPS location"}`, incident.description].filter(Boolean).join("\n")
          : undefined,
        tag: `mission:${activeId}`,
        urgent: true,
      });
    }
  }, [activeId, incident]);

  function advance(to: RescueAssignment["status"]) {
    if (!active) return;
    if (to === "completed" || to === "cancelled") selfClosed.current.add(active.id);
    startTransition(async () => {
      // Staff record the step on the team's behalf (logged as such).
      const res = staffView
        ? await recordTeamUpdate({ assignmentId: active.id, status: to })
        : await updateMissionStatus({ assignmentId: active.id, status: to });
      if (res.ok) {
        setOptimistic({ id: active.id, status: to });
        toast.success(
          to === "cancelled"
            ? "Mission returned to the queue — the Operations Centre will reassign it."
            : `Status: ${ASSIGNMENT_STATUS_LABEL[to]}`,
        );
      } else {
        toast.error(res.error);
      }
      // Either way, show the authoritative state (e.g. an operator may have
      // resolved or reassigned the incident meanwhile).
      router.refresh();
    });
  }

  function toggleAvailability(available: boolean) {
    startTransition(async () => {
      const res = staffView && team
        ? await setTeamStatus(team.id, available ? "available" : "offline")
        : await setAvailability(available);
      if (res.ok) {
        toast.success(available ? "Team is available for dispatch" : "Team marked offline");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  const next = active ? RESCUE_NEXT_ACTION[active.status] : undefined;
  const stepIndex = active ? STEPS.findIndex((s) => s.status === active.status) : -1;
  const target = incident ? { lat: incident.latitude, lng: incident.longitude } : null;
  const teamPos = team ? { lat: team.latitude, lng: team.longitude } : null;

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 bg-navy text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <LogoMark />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">JalSuraksha Rescue{team && ` · Team ${team.call_sign}`}</p>
            <p className="truncate text-xs text-slate-300">{team?.name ?? "No team linked"} · {userName ?? "Rescue crew"}</p>
          </div>
          {staffView && (
            <Link
              href="/rescue"
              className="hidden items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-200 hover:bg-white/10 sm:flex"
            >
              <LayoutGrid className="size-3.5" aria-hidden /> All teams
            </Link>
          )}
          <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase", live ? "bg-safe/20 text-emerald-300" : "bg-white/10 text-slate-300")}>
            <Radio className="size-3.5" aria-hidden /> {live ? "Live" : "Connecting"}
          </span>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="icon-sm" className="text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Sign out">
              <LogOut />
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-4 p-4">
        {staffView && team && (
          <div role="note" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-info/30 bg-info-soft px-4 py-2.5 text-sm text-info-ink">
            <span>
              Viewing <span className="font-semibold">Team {team.call_sign}</span>&apos;s console as {staffView.roleLabel}. Status
              changes you make are recorded on the team&apos;s behalf by the control centre.
            </span>
            <Link href="/rescue" className="font-semibold underline">
              All teams
            </Link>
          </div>
        )}
        {!team ? (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <p className="font-semibold">Your account is not linked to a rescue team.</p>
            <p className="mt-1 text-sm text-muted-foreground">Ask an administrator to assign your team in Users & roles.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
              <div className="flex items-center gap-3">
                <TeamStatusBadge status={team.status} className="text-xs" />
                <span className="text-sm text-muted-foreground">
                  {team.personnel_count} personnel · {team.equipment.join(", ")}
                </span>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium">
                Available for dispatch
                <Switch
                  checked={team.status === "available"}
                  disabled={pending || team.status === "assigned" || team.status === "busy"}
                  onCheckedChange={toggleAvailability}
                  aria-label="Available for dispatch"
                />
              </label>
              <DesktopAlertsToggle
                className="basis-full"
                enableLabel="Notify this device about new missions (even when the app is in the background)"
                onLabel="Mission notifications are on for this device."
              />
            </div>

            {!active || !incident ? (
              <section className="flex flex-col items-center gap-2 rounded-2xl border bg-card px-6 py-14 text-center">
                <ShieldCheck className="size-10 text-safe" aria-hidden />
                <h1 className="text-lg font-semibold">No active mission</h1>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {team.status === "offline"
                    ? "Your team is offline. Switch on availability to receive missions."
                    : "Standing by. New assignments from the Operations Centre appear here instantly."}
                </p>
              </section>
            ) : (
              <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]" aria-label="Current mission" data-testid="current-mission">
                <div className="grid content-start gap-4">
                  {/* Only the crew in the field shares GPS (not staff acting on its behalf). */}
                  <LocationShare active={!staffView && isAssignmentActive(active.status)} />
                  <div className="rounded-2xl border-2 border-danger bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="label-caps text-danger-ink">Current assignment</p>
                        <h1 className="text-2xl font-bold tabular">{incident.reference_code}</h1>
                        <p className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="size-4" aria-hidden /> {incident.location_name ?? "GPS location"} ·{" "}
                          {teamPos && target && formatDistance(haversineMeters(teamPos, target))} from base
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <PriorityBadge level={incident.effective_priority ?? incident.priority_level} className="text-xs" />
                        <AssignmentStatusBadge status={active.status} />
                      </div>
                    </div>

                    <ol className="mt-4 grid grid-cols-6 gap-1" aria-label="Mission progress">
                      {STEPS.map((s, i) => (
                        <li key={s.status} className="grid gap-1 text-center">
                          <span className={cn("h-1.5 rounded-full", i <= stepIndex ? "bg-safe" : "bg-muted")} aria-hidden />
                          <span className={cn("text-[10px] font-medium", i <= stepIndex ? "text-foreground" : "text-muted-foreground")}>
                            {s.label}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <LiveMap
                    className="h-[340px]"
                    center={target!}
                    zoom={14}
                    sos={[incident]}
                    teams={[team]}
                    hospitals={hospitals}
                    selectedSosId={incident.id}
                    fitBounds={teamPos && target ? { key: `mission:${active.id}`, points: [teamPos, target] } : undefined}
                    routes={teamPos && target ? [{ id: "to-incident", variant: "direct", path: [teamPos, target], label: "Direct line to incident" }] : []}
                  />
                </div>

                <div className="grid content-start gap-4">
                  <div className="grid gap-2 rounded-2xl border bg-card p-4">
                    {next ? (
                      <Button
                        size="xl"
                        variant={next.to === "completed" ? "safe" : "default"}
                        className="w-full text-lg"
                        onClick={() => advance(next.to)}
                        disabled={pending}
                        data-testid="rescue-next-action"
                      >
                        {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                        {next.label}
                      </Button>
                    ) : null}
                    {active.status === "arrived" && (
                      <Button variant="safe" size="lg" onClick={() => advance("completed")} disabled={pending}>
                        <CheckCircle2 /> Completed (skip)
                      </Button>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Button asChild variant="outline">
                        <a
                          href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${teamPos?.lat}%2C${teamPos?.lng}%3B${incident.latitude}%2C${incident.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Navigation /> Navigate
                        </a>
                      </Button>
                      <Button asChild variant="outline">
                        <a href={`tel:${incident.phone}`}><Phone /> Call</a>
                      </Button>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-danger-ink">
                          <XCircle /> Unable to complete — return to queue
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Return {incident.reference_code} to the queue?</DialogTitle>
                          <DialogDescription>
                            The Operations Centre will reassign it to another team. Use this if you cannot reach the location or need different equipment.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <DialogClose asChild><Button variant="outline">Keep mission</Button></DialogClose>
                          <DialogClose asChild>
                            <Button variant="destructive" onClick={() => advance("cancelled")}>Return to queue</Button>
                          </DialogClose>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="grid gap-3 rounded-2xl border bg-card p-4 text-sm">
                    <p className="font-semibold">People & vulnerability</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Fact icon={Users} label="People" value={incident.people_count} />
                      <Fact icon={Baby} label="Children" value={incident.children_count} />
                      <Fact icon={PersonStanding} label="Elderly" value={incident.elderly_count} />
                      <Fact icon={HeartPulse} label="Injured" value={incident.injured ? "YES" : "No"} danger={incident.injured} />
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-xs text-muted-foreground">Situation</p>
                      <p className="font-semibold">{SITUATION_LABEL[incident.situation]}</p>
                      {incident.description && (
                        <p className="mt-1 flex gap-1.5"><MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />{incident.description}</p>
                      )}
                    </div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                      <dt className="text-muted-foreground">Contact</dt><dd>{formatPhone(incident.phone)}</dd>
                      <dt className="text-muted-foreground">Coordinates</dt><dd className="tabular">{incident.latitude.toFixed(5)}, {incident.longitude.toFixed(5)}</dd>
                      <dt className="text-muted-foreground">SOS sent</dt><dd>{formatClock(incident.created_at)} ({timeAgo(incident.created_at)})</dd>
                      <dt className="text-muted-foreground">Assigned</dt><dd>{formatClock(active.assigned_at)}</dd>
                    </dl>
                  </div>
                </div>
              </section>
            )}

            {history.length > 0 && (
              <section className="rounded-2xl border bg-card p-4">
                <h2 className="text-sm font-semibold">Missions in the last 24 h</h2>
                <ul className="mt-2 divide-y text-sm">
                  {history.map((a) => {
                    const s = incidents.find((i) => i.id === a.sos_id);
                    return (
                      <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0">
                          <span className="font-semibold tabular">{s?.reference_code ?? "Incident"}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{s?.location_name}</span>
                        </span>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          {formatClock(a.completed_at ?? a.assigned_at)}
                          <AssignmentStatusBadge status={a.status} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Fact({ icon: Icon, label, value, danger }: { icon: typeof Users; label: string; value: string | number; danger?: boolean }) {
  return (
    <div className={danger ? "rounded-lg bg-danger-soft p-2 text-danger-ink" : "rounded-lg bg-muted p-2"}>
      <p className="flex items-center gap-1 text-xs opacity-80"><Icon className="size-3.5" aria-hidden />{label}</p>
      <p className="text-lg font-bold tabular">{value}</p>
    </div>
  );
}
