/**
 * Live hydro-met data (DHM gauges and rain stations via the BIPAD portal)
 * applied to risk zones. Pure functions — no I/O — so they are unit-tested
 * and safe on server and client.
 *
 * Honesty rules:
 *  - A reading older than RIVER_FRESH_HOURS / RAIN_FRESH_HOURS is "stale": it
 *    is shown with its age but never used as the current level (DHM keeps
 *    the last value of offline stations, e.g. "ABOVE DANGER" from months ago).
 *  - In simulation mode nothing is replaced and the UI labels it SIMULATION.
 */
import { haversineMeters } from "@/lib/utilities/geo";
import type { Database } from "@/types/database.types";
import type { RiskZone } from "@/types/domain";

export type DataMode = "live" | "simulation";
export type HydrometStation = Database["public"]["Tables"]["hydromet_stations"]["Row"];

export const RIVER_FRESH_HOURS = 6;
export const RAIN_FRESH_HOURS = 6;
/**
 * How far a zone may be from the gauge / rain station that represents it. A
 * gauge on the same river may be well upstream (e.g. East Rapti at Rajaiya
 * gives Chitwan its early warning for Sauraha), hence the larger river radius.
 */
export const RIVER_STATION_MAX_KM = 60;
export const RAIN_STATION_MAX_KM = 20;

export type RiverReading = {
  stationId: string;
  stationName: string;
  levelM: number | null;
  warningM: number | null;
  dangerM: number | null;
  /** No official danger level: the warning level is used for both. */
  dangerEstimated: boolean;
  trend: string | null;
  officialStatus: string | null;
  observedAt: string | null;
  fresh: boolean;
  source: string;
};

export type RainReading = {
  stationId: string;
  stationName: string;
  mm1h: number | null;
  mm24h: number | null;
  observedAt: string | null;
  fresh: boolean;
  source: string;
};

export type ZoneReading = {
  mode: DataMode;
  river: RiverReading | null;
  rain: RainReading | null;
};

export type LiveRiskZone = RiskZone & { reading: ZoneReading };

const num = (v: unknown): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

export function isFresh(observedAt: string | null | undefined, maxHours: number, now: Date = new Date()): boolean {
  if (!observedAt) return false;
  const age = now.getTime() - new Date(observedAt).getTime();
  return age >= -15 * 60_000 && age <= maxHours * 3600_000;
}

function riverName(zone: Pick<RiskZone, "river_name">): string {
  return (zone.river_name ?? "").toLowerCase().replace(/\briver\b/g, "").trim();
}

/** The gauge on the zone's river, nearest first (fresh gauges preferred). */
export function pickRiverStation(
  zone: Pick<RiskZone, "river_name" | "center_latitude" | "center_longitude" | "river_station_id">,
  stations: HydrometStation[],
  now: Date = new Date(),
): HydrometStation | null {
  const rivers = stations.filter((s) => s.kind === "river");
  if (zone.river_station_id) {
    const explicit = rivers.find((s) => s.id === zone.river_station_id);
    if (explicit) return explicit;
  }
  const name = riverName(zone);
  const center = { lat: zone.center_latitude, lng: zone.center_longitude };
  const candidates = rivers
    .filter((s) => num(s.warning_level_m) !== null)
    .filter((s) => !name || s.name.toLowerCase().includes(name.split(" ")[0]))
    .map((s) => ({ s, d: haversineMeters(center, { lat: s.latitude, lng: s.longitude }) }))
    .filter((c) => c.d <= RIVER_STATION_MAX_KM * 1000)
    .sort((a, b) => Number(isFresh(b.s.observed_at, RIVER_FRESH_HOURS, now)) - Number(isFresh(a.s.observed_at, RIVER_FRESH_HOURS, now)) || a.d - b.d);
  return candidates[0]?.s ?? null;
}

/** Nearest rain station with a fresh reading. */
export function pickRainStation(
  zone: Pick<RiskZone, "center_latitude" | "center_longitude">,
  stations: HydrometStation[],
  now: Date = new Date(),
): HydrometStation | null {
  const center = { lat: zone.center_latitude, lng: zone.center_longitude };
  return (
    stations
      .filter((s) => s.kind === "rain" && isFresh(s.observed_at, RAIN_FRESH_HOURS, now) && num(s.rain_24h_mm) !== null)
      .map((s) => ({ s, d: haversineMeters(center, { lat: s.latitude, lng: s.longitude }) }))
      .filter((c) => c.d <= RAIN_STATION_MAX_KM * 1000)
      .sort((a, b) => a.d - b.d)[0]?.s ?? null
  );
}

export function toRiverReading(s: HydrometStation, now: Date = new Date()): RiverReading {
  const warning = num(s.warning_level_m);
  const danger = num(s.danger_level_m);
  return {
    stationId: s.id,
    stationName: s.name,
    levelM: num(s.water_level_m),
    warningM: warning,
    dangerM: danger ?? warning,
    dangerEstimated: danger === null && warning !== null,
    trend: s.trend,
    officialStatus: s.official_status,
    observedAt: s.observed_at,
    fresh: isFresh(s.observed_at, RIVER_FRESH_HOURS, now) && num(s.water_level_m) !== null && warning !== null,
    source: s.data_source,
  };
}

export function toRainReading(s: HydrometStation, now: Date = new Date()): RainReading {
  return {
    stationId: s.id,
    stationName: s.name,
    mm1h: num(s.rain_1h_mm),
    mm24h: num(s.rain_24h_mm),
    observedAt: s.observed_at,
    fresh: isFresh(s.observed_at, RAIN_FRESH_HOURS, now) && num(s.rain_24h_mm) !== null,
    source: s.data_source,
  };
}

/**
 * Live mode: fresh gauge and rain readings replace each zone's river level,
 * thresholds and 24 h rainfall. Stale or missing readings leave the numbers
 * alone but are flagged, and the risk engine then excludes those factors.
 */
export function applyLiveReadings(
  zones: RiskZone[],
  stations: HydrometStation[],
  mode: DataMode,
  now: Date = new Date(),
): LiveRiskZone[] {
  if (mode === "simulation") return zones.map((z) => ({ ...z, reading: { mode, river: null, rain: null } }));
  return zones.map((z) => {
    const riverStation = pickRiverStation(z, stations, now);
    const rainStation = pickRainStation(z, stations, now);
    const river = riverStation ? toRiverReading(riverStation, now) : null;
    const rain = rainStation ? toRainReading(rainStation, now) : null;
    // road_access_reduction is a scenario value; in live mode real blockages
    // come from community hazard reports (the "reports" factor) instead.
    const next: LiveRiskZone = { ...z, source_type: "official", road_access_reduction: 0, reading: { mode, river, rain } };
    if (river?.fresh) {
      next.river_level_m = river.levelM!;
      next.warning_level_m = river.warningM!;
      next.danger_level_m = river.dangerM!;
      next.observed_at = river.observedAt ?? z.observed_at;
    }
    if (rain?.fresh) next.rainfall_mm_24h = rain.mm24h!;
    return next;
  });
}

export type GaugeAlertLevel = "danger" | "warning" | null;

/** Official threshold crossed by a fresh reading (stale readings never alert). */
export function gaugeAlertLevel(s: HydrometStation, now: Date = new Date()): GaugeAlertLevel {
  const r = toRiverReading(s, now);
  if (!r.fresh || r.levelM === null || r.warningM === null) return null;
  if (!r.dangerEstimated && r.dangerM !== null && r.levelM >= r.dangerM) return "danger";
  if (r.levelM >= r.warningM) return "warning";
  return null;
}
