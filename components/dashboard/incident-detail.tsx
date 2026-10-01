"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  ArrowLeft,
  Baby,
  Clock3,
  HeartPulse,
  Info,
  MapPin,
  MessageSquareText,
  Phone,
  PersonStanding,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";
import { acknowledgeSos } from "@/app/dashboard/actions";
import { LiveMap } from "@/components/map";
import {
  AssignmentStatusBadge,
  PriorityBadge,
  SafetyStatusBadge,
  SosStatusBadge,
  TeamStatusBadge,
} from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRIORITY_DISCLAIMER, SITUATION_LABEL, type PriorityFactor } from "@/lib/risk-engine/sos-priority";
import { useRealtimeRows } from "@/lib/supabase/use-realtime-rows";
import { formatClock, formatDateTime, formatPhone, timeAgo } from "@/lib/utilities/format";
import { formatDistance, haversineMeters } from "@/lib/utilities/geo";
import { isAssignmentActive, isSosOpen } from "@/lib/utilities/status";
import type { IncidentStatusHistory } from "@/types/domain";
import { AssignTeamDialog } from "./assign-team-dialog";
import { useOpsData } from "./ops-data";
import { PriorityDialog } from "./priority-dialog";
import { ResolveDialog } from "./resolve-dialog";
import { TeamUpdateControl } from "./team-update-control";

export function IncidentDetail({
  sosId,
  initialHistory,
  photoUrl,
}: {
  sosId: string;
  initialHistory: IncidentStatusHistory[];
  photoUrl: string | null;
}) {
  const data = useOpsData();
  const sos = data.sos.find((s) => s.id === sosId);
  const history = useRealtimeRows("incident_status_history", initialHistory, { filter: `sos_id=eq.${sosId}` });
  const acked = useRef(false);

  // Opening an incident acknowledges it ("Control centre notified").
  useEffect(() => {
    if (sos && sos.status === "received" && !acked.current) {
      acked.current = true;
      void acknowledgeSos(sos.id);
    }
  }, [sos]);

  if (!sos) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          This incident is outside the current 24-hour window or no longer exists.
        </p>
        <Button asChild variant="outline" className="mt-3">
          <Link href="/dashboard"><ArrowLeft /> Back to operations</Link>
        </Button>
      </div>
    );
  }

  const level = sos.effective_priority ?? sos.priority_level;
  const team = sos.assigned_team_id ? data.teamById.get(sos.assigned_team_id) : undefined;
  const assignment = data.assignments
    .filter((a) => a.sos_id === sos.id)
    .sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime())[0];
  const open = isSosOpen(sos.status);
  const citizen = sos.user_id ? data.citizenById.get(sos.user_id) : undefined;
  const canAssign = open && ["received", "acknowledged", "assigned", "accepted"].includes(sos.status);
  const factors = (Array.isArray(sos.priority_factors) ? sos.priority_factors : []) as PriorityFactor[];
  const point = { lat: sos.latitude, lng: sos.longitude };
  const timeline = [...history.rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:p-5">
      {sos.status === "cancelled" && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-safe/40 bg-safe-soft px-4 py-3 text-sm text-safe-ink">
          <ShieldCheck className="size-5 shrink-0" aria-hidden />
          <span>
            <span className="font-semibold">The citizen reported they are safe</span> and closed this SOS
            {sos.resolved_at ? ` at ${formatClock(sos.resolved_at)}` : ""}. Any assigned team was released.
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard" className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" aria-hidden /> Operations
          </Link>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight tabular">
            {sos.reference_code}
            <PriorityBadge level={level} overridden={Boolean(sos.operator_priority_override)} className="text-xs" />
            <SosStatusBadge status={sos.status} className="text-xs" />
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="size-4" aria-hidden />{sos.location_name ?? "GPS location"}</span>
            <span className="flex items-center gap-1"><Clock3 className="size-4" aria-hidden />{formatDateTime(sos.created_at)} ({timeAgo(sos.created_at)})</span>
            <span>Source: {sos.source.toUpperCase()}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAssign && (
            <AssignTeamDialog
              sos={sos}
              trigger={
                <Button size="lg" data-testid="assign-team">
                  <Truck /> {sos.assigned_team_id ? "Reassign team" : "Assign Rescue Team"}
                </Button>
              }
            />
          )}
          {open && <PriorityDialog sos={sos} trigger={<Button size="lg" variant="outline">Change Priority</Button>} />}
          {open && <ResolveDialog sos={sos} trigger={<Button size="lg" variant="outline">Mark Resolved</Button>} />}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-4">
          <LiveMap
            className="h-[380px]"
            center={point}
            zoom={15}
            sos={[sos]}
            teams={data.teamsLive}
            shelters={data.shelters}
            hospitals={data.hospitals}
            hazards={data.hazards}
            zones={data.zones}
            selectedSosId={sos.id}
            routes={
              team && assignment && isAssignmentActive(assignment.status)
                ? [{ id: "team-line", variant: "direct", path: [{ lat: team.latitude, lng: team.longitude }, point], label: `Team ${team.call_sign} → incident (straight line)` }]
                : []
            }
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>People & vulnerability</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <Stat icon={Users} label="People" value={sos.people_count} />
                <Stat icon={Baby} label="Children" value={sos.children_count} />
                <Stat icon={PersonStanding} label="Elderly" value={sos.elderly_count} />
                <Stat icon={HeartPulse} label="Injury" value={sos.injured ? "YES" : "No"} danger={sos.injured} />
                <div className="col-span-2 rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Situation</p>
                  <p className="font-semibold">{SITUATION_LABEL[sos.situation]}</p>
                  {sos.description && (
                    <p className="mt-1 flex gap-1.5 text-sm"><MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />{sos.description}</p>
                  )}
                </div>
                {photoUrl && (
                  <a href={photoUrl} target="_blank" rel="noreferrer" className="col-span-2 overflow-hidden rounded-lg border">
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                    <img src={photoUrl} alt={`Photo attached to ${sos.reference_code}`} className="max-h-56 w-full object-cover" />
                  </a>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Contact & location</CardTitle></CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <Button asChild variant="outline" className="justify-start">
                  <a href={`tel:${sos.phone}`}><Phone /> {formatPhone(sos.phone)}</a>
                </Button>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Coordinates</dt>
                  <dd className="tabular">{sos.latitude.toFixed(5)}, {sos.longitude.toFixed(5)}</dd>
                  <dt className="text-muted-foreground">GPS accuracy</dt>
                  <dd>{sos.location_accuracy_m ? `±${sos.location_accuracy_m} m` : "Unknown"}</dd>
                  <dt className="text-muted-foreground">Account</dt>
                  <dd>{sos.user_id ? "App session" : "Guest (no session)"}</dd>
                  {citizen && (
                    <>
                      <dt className="text-muted-foreground">Family status</dt>
                      <dd className="flex flex-wrap items-center gap-1.5">
                        <SafetyStatusBadge status={citizen.safety_status} />
                        {citizen.safety_updated_at && (
                          <span className="text-xs text-muted-foreground">{timeAgo(citizen.safety_updated_at)}</span>
                        )}
                      </dd>
                    </>
                  )}
                </dl>
                <Button asChild variant="ghost" size="sm" className="justify-start">
                  <a href={`https://www.openstreetmap.org/?mlat=${sos.latitude}&mlon=${sos.longitude}#map=17/${sos.latitude}/${sos.longitude}`} target="_blank" rel="noreferrer">
                    <MapPin /> Open in OpenStreetMap
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Priority recommendation</CardTitle>
                <span className="text-sm font-bold tabular">{sos.priority_score}/100</span>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <ul className="grid gap-1">
                {factors.map((f) => (
                  <li key={f.label} className="flex justify-between gap-3">
                    <span>{f.label}</span>
                    <span className="font-semibold tabular">+{f.points}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-muted-foreground">Recommended</span>
                <PriorityBadge level={sos.priority_level} />
              </div>
              {sos.operator_priority_override && (
                <div className="rounded-lg bg-accent p-2 text-xs">
                  <p className="font-semibold">Operator override: {sos.operator_priority_override.toUpperCase()}</p>
                  {sos.priority_override_note && <p className="text-muted-foreground">{sos.priority_override_note}</p>}
                </div>
              )}
              <p className="flex gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {PRIORITY_DISCLAIMER}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Rescue assignment</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {team && assignment ? (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-bold">Team {team.call_sign}</p>
                    <AssignmentStatusBadge status={assignment.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{team.name} · {team.personnel_count} personnel · {team.equipment.join(", ")}</p>
                  <div className="flex items-center justify-between text-xs">
                    <TeamStatusBadge status={team.status} />
                    <span>{formatDistance(haversineMeters(point, { lat: team.latitude, lng: team.longitude }))} from base</span>
                  </div>
                  <dl className="mt-1 grid grid-cols-2 gap-1 text-xs">
                    <dt className="text-muted-foreground">Assigned</dt><dd>{formatClock(assignment.assigned_at)}</dd>
                    <dt className="text-muted-foreground">Accepted</dt><dd>{formatClock(assignment.accepted_at)}</dd>
                    <dt className="text-muted-foreground">En route</dt><dd>{formatClock(assignment.en_route_at)}</dd>
                    <dt className="text-muted-foreground">Arrived</dt><dd>{formatClock(assignment.arrived_at)}</dd>
                    <dt className="text-muted-foreground">Completed</dt><dd>{formatClock(assignment.completed_at)}</dd>
                  </dl>
                  {open && isAssignmentActive(assignment.status) && (
                    <TeamUpdateControl assignment={assignment} callSign={team.call_sign} />
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">{open ? "No team assigned yet." : "Closed without a team."}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Incident log</CardTitle></CardHeader>
            <CardContent>
              <ol className="grid gap-3 border-l pl-4 text-sm" aria-live="polite">
                {timeline.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-card bg-primary" aria-hidden />
                    <p className="font-medium">{h.note ?? h.to_status}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatClock(h.created_at)} · {h.actor_role}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  danger,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div className={danger ? "rounded-lg bg-danger-soft p-2 text-danger-ink" : "rounded-lg bg-muted p-2"}>
      <p className="flex items-center gap-1 text-xs opacity-80"><Icon className="size-3.5" aria-hidden />{label}</p>
      <p className="text-xl font-bold tabular">{value}</p>
    </div>
  );
}
