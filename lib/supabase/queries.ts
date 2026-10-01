import "server-only";

import { unstable_rethrow } from "next/navigation";
import { after } from "next/server";
import { applyLiveReadings, type DataMode, type LiveRiskZone } from "@/lib/hydromet/live";
import { maybeSyncHydromet } from "@/lib/hydromet/sync";
import type { Alert, HazardReport, Hospital, Shelter } from "@/types/domain";
import { createSupabaseServerClient } from "./server";
import { isSupabaseConfigured } from "./env";

export type PublicSnapshot = {
  alerts: Alert[];
  /** Risk zones with live DHM readings applied (or flagged) per data mode. */
  zones: LiveRiskZone[];
  shelters: Shelter[];
  hazards: HazardReport[];
  /** Real hospitals in the pilot area (BIPAD portal). */
  hospitals: Hospital[];
  dataMode: DataMode;
  /** Last successful DHM/BIPAD sync, if any. */
  hydrometSyncedAt: string | null;
  fetchedAt: string;
  ok: boolean;
};

const HAZARD_WINDOW_HOURS = 72;

/**
 * Public situational data (RLS: readable by anyone). Never throws — a failed
 * fetch returns ok:false so the UI can fall back to its offline snapshot.
 */
export async function getPublicSnapshot(): Promise<PublicSnapshot> {
  const empty: PublicSnapshot = {
    alerts: [],
    zones: [],
    shelters: [],
    hazards: [],
    hospitals: [],
    dataMode: "live",
    hydrometSyncedAt: null,
    fetchedAt: new Date().toISOString(),
    ok: false,
  };
  if (!isSupabaseConfigured()) return empty;
  // Keep DHM readings fresh without a scheduler: refresh after responding
  // when the last sync is older than 10 minutes.
  after(maybeSyncHydromet);

  try {
    const supabase = await createSupabaseServerClient();
    const since = new Date(Date.now() - HAZARD_WINDOW_HOURS * 3600_000).toISOString();
    const [alerts, zones, shelters, hazards, stations, settings, hospitals] = await Promise.all([
      supabase
        .from("alerts")
        .select("*")
        .eq("is_active", true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("risk_zones").select("*").order("name"),
      supabase.from("shelters").select("*").eq("is_active", true).order("name"),
      supabase
        .from("hazard_reports")
        .select("*")
        .neq("status", "rejected")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("hydromet_stations").select("*"),
      supabase.from("app_settings").select("key, value").in("key", ["data_mode", "hydromet_last_sync"]),
      supabase.from("facilities").select("id, name, latitude, longitude, phone").eq("kind", "hospital").order("name"),
    ]);

    const error = alerts.error ?? zones.error ?? shelters.error ?? hazards.error;
    if (error) {
      console.error("[data] public snapshot failed", error.message);
      return empty;
    }

    const dataMode: DataMode = settings.data?.find((r) => r.key === "data_mode")?.value === "simulation" ? "simulation" : "live";
    const lastSync = settings.data?.find((r) => r.key === "hydromet_last_sync")?.value as { at?: string; ok?: boolean } | undefined;

    // Live mode: citizens see real alerts and reports only, never demo content.
    const real = <T extends { source_type: string }>(rows: T[]) => (dataMode === "live" ? rows.filter((r) => r.source_type !== "simulated") : rows);

    return {
      alerts: real(alerts.data ?? []),
      zones: applyLiveReadings(zones.data ?? [], stations.data ?? [], dataMode),
      shelters: shelters.data ?? [],
      hazards: real(hazards.data ?? []),
      hospitals: (hospitals.data ?? []).map((h) => ({ id: h.id, name: h.name, latitude: h.latitude, longitude: h.longitude, phone: h.phone ?? undefined })),
      dataMode,
      hydrometSyncedAt: lastSync?.ok && lastSync.at ? lastSync.at : null,
      fetchedAt: new Date().toISOString(),
      ok: true,
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[data] public snapshot failed", error);
    return empty;
  }
}
