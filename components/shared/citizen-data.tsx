"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicSnapshot } from "@/lib/supabase/queries";
import { useRealtimeRows, useResync, type RealtimeState } from "@/lib/supabase/use-realtime-rows";
import { highestRiskZone, scoreZones, zoneForPoint, type ScoredZone } from "@/lib/risk-engine/zones";
import { haversineMeters } from "@/lib/utilities/geo";
import { showDesktopAlert } from "@/lib/utilities/desktop-alerts";
import { useLocationState, type LocationState } from "@/lib/utilities/use-location";
import { HOSPITALS } from "@/lib/demo/scenario";
import type { DataMode, LiveRiskZone } from "@/lib/hydromet/live";
import type { Alert, HazardReport, Hospital, Shelter } from "@/types/domain";

const SNAPSHOT_KEY = "js:public-snapshot:v2";
/** Stable empty seed: a new [] each render would re-seed the hook forever. */
const NO_ROWS: never[] = [];

export type SessionSummary = {
  userId: string | null;
  isAnonymous: boolean;
  name: string | null;
  phone: string | null;
  role: string | null;
  safetyStatus: string | null;
};

type CitizenData = {
  alerts: Alert[];
  zones: ScoredZone<LiveRiskZone>[];
  shelters: Shelter[];
  hazards: HazardReport[];
  /** Zone containing the user's location, else the highest-risk zone. */
  focusZone: ScoredZone<LiveRiskZone> | null;
  hospitals: Hospital[];
  /** live = DHM readings drive risk; simulation = labelled demo scenario. */
  dataMode: DataMode;
  hydrometSyncedAt: string | null;
  /** True when focusZone actually contains the user. */
  focusIsUserZone: boolean;
  nearestShelters: (Shelter & { distanceM: number })[];
  lastSync: string | null;
  fromCache: boolean;
  online: boolean;
  realtime: RealtimeState;
  location: LocationState;
  session: SessionSummary;
  demoMode: boolean;
};

const Ctx = createContext<CitizenData | null>(null);

export function useCitizenData(): CitizenData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCitizenData must be used inside <CitizenDataProvider>");
  return ctx;
}

/**
 * A new alert published while the app is open: a device notification if the
 * person enabled them and the tab is in the background. The in-app alarm
 * (AlertAlarm) rings until the person closes it.
 */
function announceAlert(alert: Alert, open: () => void) {
  const title = `${alert.severity.toUpperCase()} ALERT — ${alert.title}`;
  showDesktopAlert({
    title,
    body: alert.description,
    tag: `alert:${alert.id}`,
    urgent: alert.severity === "danger",
    onOpen: open,
  });
}

function readSnapshot(): PublicSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as Partial<PublicSnapshot>;
    return {
      alerts: snap.alerts ?? [],
      zones: (snap.zones ?? []).map((z) => ({ ...z, reading: z.reading ?? { mode: snap.dataMode ?? "live", river: null, rain: null } })),
      shelters: snap.shelters ?? [],
      hazards: snap.hazards ?? [],
      hospitals: snap.hospitals ?? [],
      dataMode: snap.dataMode ?? "live",
      hydrometSyncedAt: snap.hydrometSyncedAt ?? null,
      fetchedAt: snap.fetchedAt ?? new Date(0).toISOString(),
      ok: Boolean(snap.ok),
    };
  } catch {
    return null;
  }
}

export function CitizenDataProvider({
  initial,
  session,
  demoMode,
  children,
}: {
  initial: PublicSnapshot;
  session: SessionSummary;
  demoMode: boolean;
  children: React.ReactNode;
}) {
  // If the server could not reach the database, fall back to the last snapshot.
  const [base, setBase] = useState<PublicSnapshot>(initial);
  const [fromCache, setFromCache] = useState(false);
  useEffect(() => {
    if (initial.ok) {
      try {
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(initial));
      } catch {
        // Storage full/unavailable — offline cache is best-effort.
      }
      return;
    }
    const cached = readSnapshot();
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from browser-only cache
      setBase(cached);
      setFromCache(true);
    }
  }, [initial]);

  const [lastSync, setLastSync] = useState<string | null>(initial.ok ? initial.fetchedAt : null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep in step with the chosen base snapshot
    setLastSync(base.ok ? base.fetchedAt : null);
  }, [base]);
  const touch = () => setLastSync(new Date().toISOString());
  const resync = useResync();
  const router = useRouter();
  // Alerts already on screen when the app opened are not announced again.
  const seenAlerts = useRef(new Set(initial.alerts.map((a) => a.id)));
  useEffect(() => {
    // Alerts that arrived via a snapshot refresh (e.g. after reconnecting) count as seen.
    for (const a of initial.alerts) seenAlerts.current.add(a.id);
  }, [initial]);

  const alerts = useRealtimeRows("alerts", base.alerts, {
    keep: (a) =>
      a.is_active && (!a.expires_at || new Date(a.expires_at) > new Date()) && (base.dataMode === "simulation" || a.source_type !== "simulated"),
    dropOnHidden: true,
    onEvent: (payload) => {
      touch();
      if (payload.eventType === "DELETE") return;
      const a = payload.new as Alert;
      if (!a.is_active || (a.expires_at && new Date(a.expires_at) <= new Date())) return;
      if (base.dataMode === "live" && a.source_type === "simulated") return;
      if (seenAlerts.current.has(a.id)) return;
      seenAlerts.current.add(a.id);
      announceAlert(a, () => router.push("/citizen/alerts"));
    },
    onSubscribed: resync,
  });
  const shelters = useRealtimeRows("shelters", base.shelters, {
    keep: (s) => s.is_active,
    dropOnHidden: true,
    onEvent: touch,
    onSubscribed: resync,
  });
  const hazards = useRealtimeRows("hazard_reports", base.hazards, {
    keep: (h) => h.status !== "rejected" && (base.dataMode === "simulation" || h.source_type !== "simulated"),
    dropOnHidden: true,
    onEvent: touch,
    onSubscribed: resync,
  });

  // New DHM readings or a data-mode switch: fetch a fresh snapshot.
  useRealtimeRows("hydromet_stations", NO_ROWS, { onEvent: resync, onSubscribed: resync });
  useRealtimeRows("app_settings", NO_ROWS, { onEvent: resync });

  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const location = useLocationState(demoMode);

  const value = useMemo<CitizenData>(() => {
    const sortedAlerts = [...alerts.rows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const zones = scoreZones(base.zones, hazards.rows);
    const userZone = location.location ? zoneForPoint(location.location, zones) : null;
    const focusZone = userZone ?? highestRiskZone(zones);
    const nearestShelters = location.location
      ? shelters.rows
          .map((s) => ({
            ...s,
            distanceM: haversineMeters(location.location!, { lat: s.latitude, lng: s.longitude }),
          }))
          .sort((a, b) => a.distanceM - b.distanceM)
      : shelters.rows.map((s) => ({ ...s, distanceM: Number.NaN }));

    return {
      alerts: sortedAlerts,
      zones,
      shelters: shelters.rows,
      hazards: [...hazards.rows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
      focusZone,
      focusIsUserZone: Boolean(userZone),
      nearestShelters,
      lastSync,
      fromCache,
      hospitals: base.hospitals.length > 0 || base.dataMode === "live" ? base.hospitals : HOSPITALS,
      dataMode: base.dataMode,
      hydrometSyncedAt: base.hydrometSyncedAt,
      online,
      realtime: alerts.state === "live" && hazards.state === "live" ? "live" : alerts.state,
      location,
      session,
      demoMode,
    };
  }, [alerts.rows, alerts.state, shelters.rows, hazards.rows, hazards.state, base.zones, base.hospitals, base.dataMode, base.hydrometSyncedAt, location, lastSync, fromCache, online, session, demoMode]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
