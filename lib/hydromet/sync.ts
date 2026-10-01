import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { inPilotBbox } from "@/lib/geo/pilot-area";
import { FORECAST_MAX_AGE_MS, fetchRainForecast, type RainForecast } from "@/lib/hydromet/forecast";
import { sendAlertPush } from "@/lib/services/push";
import { DATA_USER_AGENT } from "@/lib/services/reference-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database.types";
import {
  gaugeAlertLevel,
  isFresh,
  pickRainStation,
  pickRiverStation,
  RAIN_FRESH_HOURS,
  RIVER_FRESH_HOURS,
  type DataMode,
  type HydrometStation,
} from "./live";

/**
 * Pulls the latest DHM river gauges and rain stations (via the BIPAD portal
 * API) for the pilot area and applies them:
 *  - upserts hydromet_stations and appends readings to a 7-day history;
 *  - links each risk zone to its river gauge and nearest live rain station;
 *  - live mode only: raises/updates an official-gauge alert while a fresh
 *    reading is at or above the DHM warning/danger level, and withdraws it
 *    when the level drops. Alerts expire after ALERT_TTL unless renewed, so a
 *    stopped sync can never leave a stale warning up.
 */
type Admin = SupabaseClient<Database>;

const BIPAD = "https://bipadportal.gov.np/api/v1";
export const SYNC_INTERVAL_MS = 10 * 60_000;
const ALERT_TTL_MS = 3 * 3600_000;
const HISTORY_DAYS = 7;
export const HYDROMET_SOURCE = "DHM (hydrology.gov.np) via BIPAD portal";

type BipadPoint = { coordinates: [number, number] } | null;
type BipadRiverStation = {
  id: number;
  title: string;
  basin: string | null;
  point: BipadPoint;
  waterLevel: number | null;
  dangerLevel: number | null;
  warningLevel: number | null;
  waterLevelOn: string | null;
  status: string | null;
  steady: string | null;
  district: number | null;
  municipality: number | null;
};
type BipadRainStation = {
  id: number;
  title: string;
  basin: string | null;
  point: BipadPoint;
  measuredOn: string | null;
  modifiedOn: string | null;
  averages: { interval: number; value: number | null }[] | null;
  district: number | null;
  municipality: number | null;
};

async function bipad<T>(path: string): Promise<T[]> {
  const res = await fetch(`${BIPAD}${path}?format=json&limit=2000`, {
    headers: { "User-Agent": DATA_USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(60_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`BIPAD ${path} responded ${res.status}`);
  return ((await res.json()) as { results?: T[] }).results ?? [];
}

export type SyncSummary = {
  at: string;
  ok: boolean;
  riverStations: number;
  rainStations: number;
  freshRiver: number;
  freshRain: number;
  alertsRaised: number;
  alertsWithdrawn: number;
  error?: string;
};

let running: Promise<SyncSummary> | null = null;

/** Runs one sync (concurrent callers in this process share it). */
export function syncHydromet(admin: Admin = createSupabaseAdminClient()): Promise<SyncSummary> {
  running ??= runSync(admin).finally(() => {
    running = null;
  });
  return running;
}

async function runSync(admin: Admin): Promise<SyncSummary> {
  const now = new Date();
  const summary: SyncSummary = { at: now.toISOString(), ok: false, riverStations: 0, rainStations: 0, freshRiver: 0, freshRain: 0, alertsRaised: 0, alertsWithdrawn: 0 };
  try {
    const [rivers, rains] = await Promise.all([bipad<BipadRiverStation>("/river-stations/"), bipad<BipadRainStation>("/rain-stations/")]);
    const rows: Database["public"]["Tables"]["hydromet_stations"]["Insert"][] = [];

    for (const r of rivers) {
      if (!r.point?.coordinates) continue;
      const [lng, lat] = r.point.coordinates;
      if (!inPilotBbox(lat, lng)) continue;
      rows.push({
        id: `bipad:river:${r.id}`,
        kind: "river",
        name: r.title.trim(),
        basin: r.basin,
        latitude: lat,
        longitude: lng,
        district_code: r.district,
        municipality_code: r.municipality,
        warning_level_m: r.warningLevel,
        danger_level_m: r.dangerLevel,
        water_level_m: r.waterLevel,
        trend: r.steady,
        official_status: r.status,
        observed_at: r.waterLevelOn,
        fetched_at: now.toISOString(),
        data_source: HYDROMET_SOURCE,
        source_url: `${BIPAD}/river-stations/${r.id}/`,
      });
    }
    for (const r of rains) {
      if (!r.point?.coordinates) continue;
      const [lng, lat] = r.point.coordinates;
      if (!inPilotBbox(lat, lng)) continue;
      const avg = (h: number) => r.averages?.find((a) => a.interval === h)?.value ?? null;
      rows.push({
        id: `bipad:rain:${r.id}`,
        kind: "rain",
        name: r.title.trim(),
        basin: r.basin,
        latitude: lat,
        longitude: lng,
        district_code: r.district,
        municipality_code: r.municipality,
        rain_1h_mm: avg(1),
        rain_3h_mm: avg(3),
        rain_6h_mm: avg(6),
        rain_12h_mm: avg(12),
        rain_24h_mm: avg(24),
        observed_at: r.measuredOn ?? r.modifiedOn,
        fetched_at: now.toISOString(),
        data_source: HYDROMET_SOURCE,
        source_url: `${BIPAD}/rain-stations/${r.id}/`,
      });
    }

    const { error: upsertError } = await admin.from("hydromet_stations").upsert(rows, { onConflict: "id" });
    if (upsertError) throw new Error(`stations: ${upsertError.message}`);

    const stations = rows as HydrometStation[];
    summary.riverStations = stations.filter((s) => s.kind === "river").length;
    summary.rainStations = stations.filter((s) => s.kind === "rain").length;
    summary.freshRiver = stations.filter((s) => s.kind === "river" && isFresh(s.observed_at, RIVER_FRESH_HOURS, now)).length;
    summary.freshRain = stations.filter((s) => s.kind === "rain" && isFresh(s.observed_at, RAIN_FRESH_HOURS, now)).length;

    // History (fresh readings only; duplicates ignored), pruned to 7 days.
    const history = stations
      .filter((s) => s.observed_at && isFresh(s.observed_at, s.kind === "river" ? RIVER_FRESH_HOURS : RAIN_FRESH_HOURS, now))
      .map((s) => ({ station_id: s.id, observed_at: s.observed_at!, water_level_m: s.water_level_m, rain_1h_mm: s.rain_1h_mm, rain_24h_mm: s.rain_24h_mm }));
    if (history.length) await admin.from("hydromet_readings").upsert(history, { onConflict: "station_id,observed_at", ignoreDuplicates: true });
    await admin.from("hydromet_readings").delete().lt("observed_at", new Date(now.getTime() - HISTORY_DAYS * 86_400_000).toISOString());

    // Link zones to their stations (visible to staff; recomputed each sync).
    const { data: zones } = await admin.from("risk_zones").select("id, river_name, center_latitude, center_longitude, river_station_id");
    for (const z of zones ?? []) {
      const river = pickRiverStation({ ...z, river_station_id: null }, stations, now);
      const rain = pickRainStation(z, stations, now);
      await admin.from("risk_zones").update({ river_station_id: river?.id ?? null, rain_station_id: rain?.id ?? null }).eq("id", z.id);
    }

    const mode = await readDataMode(admin);
    if (mode === "live") {
      const r = await applyGaugeAlerts(admin, stations, now);
      summary.alertsRaised = r.raised;
      summary.alertsWithdrawn = r.withdrawn;
    }
    summary.ok = true;
  } catch (error) {
    summary.error = error instanceof Error ? error.message : String(error);
    console.error("[hydromet] sync failed", summary.error);
  }
  await admin.from("app_settings").upsert({ key: "hydromet_last_sync", value: summary as unknown as NonNullable<Json> });
  await refreshRainForecast(admin, now);
  return summary;
}

/**
 * Rain forecast for every risk zone (Open-Meteo), at most once an hour. A
 * failed fetch keeps the previous forecast; it never affects the river sync.
 */
async function refreshRainForecast(admin: Admin, now: Date) {
  try {
    const { data: current } = await admin.from("app_settings").select("value").eq("key", "rain_forecast").maybeSingle();
    const prev = current?.value as RainForecast | undefined;
    if (prev?.ok && now.getTime() - new Date(prev.at).getTime() < FORECAST_MAX_AGE_MS) return;
    const { data: zones } = await admin.from("risk_zones").select("id, name, center_latitude, center_longitude").order("name");
    const forecast = await fetchRainForecast(zones ?? [], fetch, now);
    await admin.from("app_settings").upsert({ key: "rain_forecast", value: forecast as unknown as NonNullable<Json> });
  } catch (error) {
    console.error("[forecast] refresh failed", error instanceof Error ? error.message : error);
  }
}

const npt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kathmandu", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

async function applyGaugeAlerts(admin: Admin, stations: HydrometStation[], now: Date) {
  let raised = 0;
  let withdrawn = 0;
  const { data: active } = await admin.from("alerts").select("id, station_id, severity").eq("is_active", true).not("station_id", "is", null);
  const activeByStation = new Map((active ?? []).map((a) => [a.station_id!, a]));

  for (const s of stations.filter((x) => x.kind === "river")) {
    const level = gaugeAlertLevel(s, now);
    const existing = activeByStation.get(s.id);
    if (!level) {
      if (existing) {
        await admin.from("alerts").update({ is_active: false }).eq("id", existing.id);
        withdrawn += 1;
      }
      continue;
    }
    const water = Number(s.water_level_m);
    const warning = Number(s.warning_level_m);
    const danger = s.danger_level_m === null ? null : Number(s.danger_level_m);
    const label = level === "danger" ? "DANGER" : "WARNING";
    const fields = {
      title: `${s.name}: river above ${label} level`,
      description: `DHM gauge reads ${water.toFixed(2)} m at ${npt(s.observed_at!)} NPT (warning ${warning.toFixed(1)} m${
        danger !== null ? `, danger ${danger.toFixed(1)} m` : ""
      }). Trend: ${(s.trend ?? "unknown").toLowerCase()}. Stay away from the river bank and be ready to move to higher ground.`,
      severity: (level === "danger" ? "danger" : "high") as Database["public"]["Enums"]["alert_severity"],
      source: "DHM river gauge (hydrology.gov.np via BIPAD)",
      source_type: "official" as const,
      river_basin: s.basin,
      district: null,
      expires_at: new Date(now.getTime() + ALERT_TTL_MS).toISOString(),
      is_active: true,
    };
    if (existing) {
      await admin.from("alerts").update(fields).eq("id", existing.id);
    } else {
      const { data: alert, error } = await admin.from("alerts").insert({ ...fields, station_id: s.id }).select().single();
      if (!error && alert) {
        raised += 1;
        await sendAlertPush(alert);
      }
    }
  }
  return { raised, withdrawn };
}

export async function readDataMode(admin: Admin): Promise<DataMode> {
  const { data } = await admin.from("app_settings").select("value").eq("key", "data_mode").maybeSingle();
  return data?.value === "simulation" ? "simulation" : "live";
}

/** Sync if the last one is older than SYNC_INTERVAL_MS (live mode only). */
export async function maybeSyncHydromet(): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin.from("app_settings").select("key, value").in("key", ["data_mode", "hydromet_last_sync"]);
    const mode = data?.find((d) => d.key === "data_mode")?.value === "simulation" ? "simulation" : "live";
    const last = data?.find((d) => d.key === "hydromet_last_sync")?.value as { at?: string } | undefined;
    const age = last?.at ? Date.now() - new Date(last.at).getTime() : Infinity;
    if (mode === "live" && age > SYNC_INTERVAL_MS) await syncHydromet(admin);
  } catch (error) {
    console.error("[hydromet] background sync skipped", error instanceof Error ? error.message : error);
  }
}
