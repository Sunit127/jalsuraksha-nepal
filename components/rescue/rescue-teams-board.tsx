"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, LogOut, MapPin, MessageSquareText, Radio, ShieldCheck, Users } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { LogoMark } from "@/components/shared/logo";
import { AssignmentStatusBadge, PriorityBadge, TeamStatusBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { SITUATION_LABEL } from "@/lib/risk-engine/sos-priority";
import type { StaffSos } from "@/lib/supabase/ops-queries";
import { getSupabaseBrowserClient, prepareRealtime } from "@/lib/supabase/client";
import { useResync } from "@/lib/supabase/use-realtime-rows";
import { timeAgo } from "@/lib/utilities/format";
import { cn } from "@/lib/utils";
import type { RescueAssignment, RescueTeam } from "@/types/domain";

const STEPS: { status: RescueAssignment["status"]; label: string }[] = [
  { status: "assigned", label: "Assigned" },
  { status: "accepted", label: "Accepted" },
  { status: "en_route", label: "En route" },
  { status: "arrived", label: "Arrived" },
  { status: "in_progress", label: "Rescue" },
  { status: "completed", label: "Done" },
];

/**
 * Staff view of /rescue: every team's live status and current mission, with
 * a link into each team's console. Refreshes on any assignment, team or SOS
 * change.
 */
export function RescueTeamsBoard({
  teams,
  assignments,
  incidents,
  userName,
  roleLabel,
}: {
  teams: RescueTeam[];
  assignments: RescueAssignment[];
  incidents: StaffSos[];
  userName: string | null;
  roleLabel: string;
}) {
  const router = useRouter();
  const resync = useResync();
  const [live, setLive] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const refresh = () => router.refresh();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void prepareRealtime().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel("rescue:all-teams")
        .on("postgres_changes", { event: "*", schema: "public", table: "rescue_assignments" }, refresh)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rescue_teams" }, refresh)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sos_requests" }, refresh)
        .subscribe((s) => {
          setLive(s === "SUBSCRIBED");
          if (s === "SUBSCRIBED") resync();
        });
    });
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [router, resync]);

  const activeByTeam = new Map(assignments.map((a) => [a.rescue_team_id, a]));
  const sorted = [...teams].sort(
    (a, b) => Number(activeByTeam.has(b.id)) - Number(activeByTeam.has(a.id)) || a.call_sign.localeCompare(b.call_sign),
  );
  const onMission = sorted.filter((t) => activeByTeam.has(t.id)).length;

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 bg-navy text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <LogoMark />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">JalSuraksha Rescue · All teams</p>
            <p className="truncate text-xs text-slate-300">
              {userName ?? "Staff"} · {roleLabel}
            </p>
          </div>
          <Link href="/dashboard" className="hidden items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-200 hover:bg-white/10 sm:flex">
            <ArrowLeft className="size-3.5" aria-hidden /> Operations
          </Link>
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

      <main className="mx-auto grid max-w-6xl gap-4 p-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Rescue teams in the field</h1>
          <p className="text-sm text-muted-foreground">
            {onMission} of {teams.length} teams on a mission. Updates appear live; open a team&apos;s console to follow it or
            record progress they report by radio.
          </p>
        </div>

        <ul className="grid gap-3 md:grid-cols-2">
          {sorted.map((team) => {
            const a = activeByTeam.get(team.id);
            const sos = a ? incidents.find((s) => s.id === a.sos_id) : undefined;
            const step = a ? STEPS.findIndex((s) => s.status === a.status) : -1;
            return (
              <li key={team.id} className={cn("flex flex-col gap-3 rounded-2xl border bg-card p-4", a && "border-danger/40")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-bold">Team {team.call_sign}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {team.name} · {team.personnel_count} personnel · {team.equipment.join(", ")}
                    </p>
                  </div>
                  <TeamStatusBadge status={team.status} />
                </div>

                {a && sos ? (
                  <div className="grid gap-2 rounded-xl bg-muted/50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-bold">{sos.reference_code}</span>
                        {(sos.effective_priority ?? sos.priority_level) && (
                          <PriorityBadge level={(sos.effective_priority ?? sos.priority_level)!} overridden={Boolean(sos.operator_priority_override)} />
                        )}
                      </span>
                      <AssignmentStatusBadge status={a.status} />
                    </div>
                    <ol className="grid grid-cols-6 gap-1" aria-label="Mission progress">
                      {STEPS.map((s, i) => (
                        <li key={s.status} className="grid gap-1">
                          <span className={cn("h-1.5 rounded-full", i <= step ? "bg-safe" : "bg-border")} />
                          <span className={cn("text-[10px]", i === step ? "font-semibold text-foreground" : "text-muted-foreground")}>{s.label}</span>
                        </li>
                      ))}
                    </ol>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="size-3.5" aria-hidden />{sos.people_count} people</span>
                      <span className="flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{sos.location_name ?? "GPS location"}</span>
                      <span>assigned {timeAgo(a.assigned_at)}</span>
                    </p>
                    <p className="flex gap-1.5 text-sm">
                      <MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="line-clamp-2">
                        <span className="font-medium">{SITUATION_LABEL[sos.situation] ?? "SOS"}</span>
                        {sos.description ? ` — ${sos.description}` : ""}
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">
                    <ShieldCheck className="size-4 text-safe" aria-hidden /> No active mission
                  </p>
                )}

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                  {sos ? (
                    <Link href={`/dashboard/incidents/${sos.id}`} className="text-xs font-medium text-primary hover:underline">
                      Incident details
                    </Link>
                  ) : (
                    <span />
                  )}
                  <Button asChild size="sm" variant={a ? "default" : "outline"}>
                    <Link href={`/rescue?team=${team.id}`}>
                      Open console <ChevronRight />
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
