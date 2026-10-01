"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CitizenStatus, OpsSnapshot, StaffSos } from "@/lib/supabase/ops-queries";
import { useRealtimeRows, useResync, type RealtimeState } from "@/lib/supabase/use-realtime-rows";
import { scoreZones, type ScoredZone } from "@/lib/risk-engine/zones";
import { showDesktopAlert } from "@/lib/utilities/desktop-alerts";
import type { DataMode, HydrometStation, LiveRiskZone } from "@/lib/hydromet/live";
import type { Alert, HazardReport, Hospital, RescueAssignment, RescueTeam, Shelter } from "@/types/domain";

/** Something a citizen changed, shown in the notification bell's feed. */
export type OpsUpdate = {
  id: string;
  tone: "danger" | "safe" | "info";
  title: string;
  body: string;
  href?: string;
  at: string;
};

type OpsData = {
  sos: StaffSos[];
  teams: RescueTeam[];
  assignments: RescueAssignment[];
  shelters: Shelter[];
  hazards: HazardReport[];
  alerts: Alert[];
  zones: ScoredZone<LiveRiskZone>[];
  hospitals: Hospital[];
  stations: HydrometStation[];
  dataMode: DataMode;
  hydrometSync: OpsSnapshot["hydrometSync"];
  realtime: RealtimeState;
  /** False when the last server snapshot failed (data may be incomplete). */
  snapshotOk: boolean;
  fetchedAt: string;
  /** SOS ids that arrived in this session (highlighted in the queue). */
  newIds: Set<string>;
  teamById: Map<string, RescueTeam>;
  /** Teams placed at their live GPS position when shared in the last 30 min. */
  teamsLive: (RescueTeam & { liveUpdatedAt: string | null })[];
  /** Citizens' family safety reports (live). */
  citizens: CitizenStatus[];
  citizenById: Map<string, CitizenStatus>;
  /** Citizen changes received while this dashboard was open (newest first). */
  updates: OpsUpdate[];
  unreadUpdates: number;
  markUpdatesRead: () => void;
};

const Ctx = createContext<OpsData | null>(null);
/** Stable empty seed: a new [] each render would re-seed the hook forever. */
const NO_ROWS: never[] = [];

export function useOpsData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOpsData must be used inside <OpsDataProvider>");
  return ctx;
}

function beep() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.value = 0.04;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch {
    // Audio may be blocked until the operator interacts with the page.
  }
}

export function OpsDataProvider({ initial, children }: { initial: OpsSnapshot; children: React.ReactNode }) {
  const router = useRouter();
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const seen = useRef(new Set(initial.sos.map((s) => s.id)));
  // Any channel (re)join, tab refocus or reconnect → fetch a fresh snapshot,
  // so nothing that happened while disconnected is missed.
  const resync = useResync();

  // Citizen-driven changes (marked safe, family status) → toast + desktop alert + bell feed.
  const [updates, setUpdates] = useState<OpsUpdate[]>([]);
  const [readAt, setReadAt] = useState(0);
  const pushUpdate = useCallback(
    (u: Omit<OpsUpdate, "at">, urgent: boolean) => {
      setUpdates((prev) => [{ ...u, at: new Date().toISOString() }, ...prev.filter((p) => p.id !== u.id)].slice(0, 30));
      const toastOpts = {
        description: u.body,
        duration: urgent ? 15_000 : 8_000,
        ...(u.href ? { action: { label: "Open", onClick: () => router.push(u.href!) } } : {}),
      };
      if (u.tone === "danger") toast.error(u.title, toastOpts);
      else if (u.tone === "safe") toast.success(u.title, toastOpts);
      else toast.info(u.title, toastOpts);
      if (urgent) beep();
      showDesktopAlert({
        title: u.title,
        body: u.body,
        tag: u.id,
        urgent,
        onOpen: u.href ? () => router.push(u.href!) : undefined,
      });
    },
    [router],
  );
  const markUpdatesRead = useCallback(() => setReadAt(Date.now()), []);

  // Last known status per SOS / citizen, to tell what actually changed.
  const sosStatus = useRef(new Map(initial.sos.map((s) => [s.id, s.status])));
  const citizenStatus = useRef(new Map(initial.citizens.map((c) => [c.id, c.safety_status])));
  useEffect(() => {
    for (const s of initial.sos) sosStatus.current.set(s.id, s.status);
    for (const c of initial.citizens) citizenStatus.current.set(c.id, c.safety_status);
  }, [initial]);

  const sos = useRealtimeRows("sos_requests", initial.sos as never, {
    onSubscribed: resync,
    onEvent: (payload) => {
      if (payload.eventType === "DELETE") return;
      const row = payload.new as StaffSos;
      const before = sosStatus.current.get(row.id);
      sosStatus.current.set(row.id, row.status);
      if (payload.eventType === "UPDATE") {
        // Only a citizen cancels an SOS ("I am safe now"); operators resolve.
        if (row.status === "cancelled" && before && before !== "cancelled" && before !== "resolved") {
          pushUpdate(
            {
              id: `safe-sos:${row.id}`,
              tone: "safe",
              title: `${row.reference_code}: citizen reports they are SAFE`,
              body: `SOS closed by the citizen · ${row.people_count} people · ${row.location_name ?? "GPS location"}${
                before === "assigned" || before === "accepted" || before === "en_route" || before === "arrived" || before === "in_progress"
                  ? " · the assigned team has been released"
                  : ""
              }`,
              href: `/dashboard/incidents/${row.id}`,
            },
            false,
          );
        }
        return;
      }
      if (seen.current.has(row.id)) return;
      seen.current.add(row.id);
      setNewIds((prev) => new Set(prev).add(row.id));
      beep();
      const priority = row.effective_priority ?? row.priority_level;
      showDesktopAlert({
        title: `New SOS ${row.reference_code} — ${priority.toUpperCase()}`,
        body: [`${row.people_count} people · ${row.location_name ?? "GPS location"}`, row.description].filter(Boolean).join("\n"),
        tag: `sos:${row.id}`,
        urgent: priority === "critical",
        onOpen: () => router.push(`/dashboard/incidents/${row.id}`),
      });
      toast.error(`New SOS ${row.reference_code} — ${(row.effective_priority ?? row.priority_level).toUpperCase()}`, {
        description: `${row.people_count} people · ${row.location_name ?? "GPS location"}${
          row.description ? ` — “${row.description.length > 90 ? `${row.description.slice(0, 90)}…` : row.description}”` : ""
        }`,
        duration: 12_000,
        action: { label: "Open", onClick: () => router.push(`/dashboard/incidents/${row.id}`) },
      });
      setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(prev);
          next.delete(row.id);
          return next;
        });
      }, 90_000);
    },
  });
  const teams = useRealtimeRows("rescue_teams", initial.teams, { onSubscribed: resync });
  const assignments = useRealtimeRows("rescue_assignments", initial.assignments, { onSubscribed: resync });
  const shelters = useRealtimeRows("shelters", initial.shelters, { onSubscribed: resync });
  const hazards = useRealtimeRows("hazard_reports", initial.hazards, { onSubscribed: resync });
  const alerts = useRealtimeRows("alerts", initial.alerts, { onSubscribed: resync });
  // Latest SOS rows, for linking a family-status change to the citizen's open SOS.
  const sosRef = useRef<StaffSos[]>([]);
  useEffect(() => {
    sosRef.current = sos.rows as unknown as StaffSos[];
  }, [sos.rows]);
  // New DHM readings or a data-mode switch: fetch a fresh snapshot.
  useRealtimeRows("hydromet_stations", NO_ROWS, { onEvent: resync });
  useRealtimeRows("app_settings", NO_ROWS, { onEvent: resync });
  const teamLocations = useRealtimeRows("team_locations", initial.teamLocations, { onSubscribed: resync });
  // Clock for "is this team position still fresh?" (re-evaluated every 30 s).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const citizens = useRealtimeRows("profiles", initial.citizens as never, {
    onSubscribed: resync,
    keep: (p) => p.role === "citizen" && p.safety_status !== "unknown",
    onEvent: (payload) => {
      if (payload.eventType === "DELETE") return;
      const p = payload.new as CitizenStatus;
      const before = citizenStatus.current.get(p.id);
      citizenStatus.current.set(p.id, p.safety_status);
      if (p.role !== "citizen" || p.safety_status === before || p.safety_status === "unknown") return;
      const who = p.full_name ?? "A citizen";
      const where = [p.ward ? `Ward ${p.ward}` : null, p.municipality, p.district].filter(Boolean).join(", ");
      const contact = [p.phone ? `+${p.phone.replace(/^\+/, "")}` : null, where || null].filter(Boolean).join(" · ");
      const openSos = (sosRef.current ?? []).find(
        (s) => s.user_id === p.id && !["resolved", "cancelled"].includes(s.status),
      );
      const href = openSos ? `/dashboard/incidents/${openSos.id}` : "/dashboard#family-safety";
      if (p.safety_status === "need_help") {
        pushUpdate(
          { id: `family:${p.id}:need_help`, tone: "danger", title: `NEED HELP — ${who}`, body: `${contact}${openSos ? ` · open ${openSos.reference_code}` : " · no SOS sent yet"}`, href },
          true,
        );
      } else if (p.safety_status === "safe") {
        pushUpdate({ id: `family:${p.id}:safe`, tone: "safe", title: `${who} reports family SAFE`, body: contact, href }, false);
      } else if (p.safety_status === "evacuated") {
        pushUpdate({ id: `family:${p.id}:evacuated`, tone: "info", title: `${who} reports family EVACUATED`, body: contact, href }, false);
      }
    },
  });

  const value = useMemo<OpsData>(() => {
    const citizenRows = [...(citizens.rows as unknown as CitizenStatus[])].sort(
      (a, b) => new Date(b.safety_updated_at ?? 0).getTime() - new Date(a.safety_updated_at ?? 0).getTime(),
    );
    const sosRows = (sos.rows as unknown as StaffSos[]).map((s) => {
      // Realtime payloads include every column; drop the guest token from memory.
      const { tracking_token: _t, ...rest } = s as StaffSos & { tracking_token?: string };
      void _t;
      return rest;
    });
    return {
      sos: sosRows,
      teams: [...teams.rows].sort((a, b) => a.call_sign.localeCompare(b.call_sign)),
      assignments: assignments.rows,
      shelters: [...shelters.rows].sort((a, b) => a.name.localeCompare(b.name)),
      hazards: [...hazards.rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      alerts: [...alerts.rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      zones: scoreZones(initial.zones, hazards.rows),
      realtime: [sos, teams, assignments].some((c) => c.state === "offline")
        ? "offline"
        : [sos, teams, assignments].every((c) => c.state === "live")
          ? "live"
          : "connecting",
      hospitals: initial.hospitals,
      stations: initial.stations,
      dataMode: initial.dataMode,
      hydrometSync: initial.hydrometSync,
      snapshotOk: initial.ok,
      fetchedAt: initial.fetchedAt,
      newIds,
      teamById: new Map(teams.rows.map((t) => [t.id, t])),
      teamsLive: [...teams.rows]
        .sort((a, b) => a.call_sign.localeCompare(b.call_sign))
        .map((t) => {
          const loc = teamLocations.rows.find((l) => l.team_id === t.id);
          const fresh = loc && now - new Date(loc.updated_at).getTime() <= 30 * 60_000;
          return fresh ? { ...t, latitude: loc.latitude, longitude: loc.longitude, liveUpdatedAt: loc.updated_at } : { ...t, liveUpdatedAt: null };
        }),
      citizens: citizenRows,
      citizenById: new Map(citizenRows.map((c) => [c.id, c])),
      updates,
      unreadUpdates: updates.filter((u) => new Date(u.at).getTime() > readAt).length,
      markUpdatesRead,
    };
  }, [sos, teams, assignments, shelters.rows, hazards.rows, alerts.rows, citizens.rows, teamLocations.rows, now, initial.zones, initial.ok, initial.fetchedAt, initial.hospitals, initial.stations, initial.dataMode, initial.hydrometSync, newIds, updates, readAt, markUpdatesRead]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
