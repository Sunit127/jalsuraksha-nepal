/**
 * Imports real reference data for the pilot area:
 *  - BIPAD portal (bipadportal.gov.np): hospitals & health facilities,
 *    helipads, fire stations, and schools as candidate shelters.
 *  - OpenStreetMap (Overpass API, ODbL): ward boundaries, and community
 *    centres / emergency assembly points as candidate shelters.
 *
 * Candidate shelters are inserted CLOSED and UNVERIFIED with no capacity;
 * staff confirm them. Re-running never overwrites a shelter staff have edited
 * (existing source_refs are skipped). Facilities and wards are refreshed.
 *
 * No "server-only" import: also used by scripts/import-reference-data.ts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { PILOT_AREA, type PilotMunicipality } from "@/lib/geo/pilot-area";
import type { Database } from "@/types/database.types";

type Admin = SupabaseClient<Database>;

const BIPAD = "https://bipadportal.gov.np/api/v1";
/** Public Overpass servers are shared and sometimes busy: try a mirror too. */
const OVERPASS_SERVERS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
export const DATA_USER_AGENT = "JalSurakshaNepal/0.1 (flood emergency response; +https://github.com/jalsuraksha-nepal)";

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 90_000): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": DATA_USER_AGENT, Accept: "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  return (await res.json()) as T;
}

type BipadPoint = { type: "Point"; coordinates: [number, number] } | null;
type BipadResource = { id: number; resourceType: string; title: string; point: BipadPoint; ward: number | null };
type BipadWard = { id: number; title: string; municipality: number };

async function bipadList<T>(path: string): Promise<T[]> {
  const data = await fetchJson<{ results: T[] }>(`${BIPAD}${path}${path.includes("?") ? "&" : "?"}format=json&limit=2000`);
  return data.results ?? [];
}

/** BIPAD ward id → ward number, for one municipality. */
async function wardNumbers(m: PilotMunicipality): Promise<Map<number, number>> {
  const wards = await bipadList<BipadWard>(`/ward/?municipality=${m.code}`);
  return new Map(wards.map((w) => [w.id, Number.parseInt(w.title, 10)]).filter(([, n]) => Number.isFinite(n)) as [number, number][]);
}

const HOSPITAL_NAME = /hospital|medical college|teaching|nursing home|hospice/i;

export type ImportSummary = Record<string, number | string>;

const NAME_NOISE = new Set([
  "pvt", "ltd", "private", "limited", "the", "and", "of", "chitwan", "chitawan", "bharatpur",
  "hospital", "clinic", "center", "centre", "health", "post",
  "school", "schools", "boarding", "english", "eng", "secondary", "higher", "primary", "basic", "college",
  "academy", "campus", "public", "shree", "shri", "sree", "vidhyalaya", "vidyalaya", "madhyamik", "community",
]);

/** Distinctive name tokens: lowercase, ASCII words, "aa"→"a", noise words dropped. */
export function nameKey(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((t) => !NAME_NOISE.has(t))
      .map((t) => t.replace(/(.)\1+/g, "$1"))
      .filter((t) => t.length > 1 && !NAME_NOISE.has(t)),
  );
}

function metersBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const dLat = (a.latitude - b.latitude) * 111_320;
  const dLng = (a.longitude - b.longitude) * 111_320 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

/**
 * BIPAD often lists one facility several times ("Aasha Hospital Pvt Ltd",
 * "asha hospital"…). Same kind, within 75 m (geocoding of one building often
 * differs that much), sharing a distinctive name token
 * → keep one (the longest, best-formatted name).
 */
export function dedupeFacilities<T extends { kind?: string | null; name: string; latitude: number; longitude: number }>(
  rows: T[],
  radiusM = 75,
): T[] {
  const kept: { row: T; key: Set<string> }[] = [];
  const score = (n: string) => (/[A-Z]/.test(n[0] ?? "") ? 100 : 0) + n.length - (/_/.test(n) ? 50 : 0);
  for (const row of [...rows].sort((a, b) => score(b.name) - score(a.name))) {
    const key = nameKey(row.name);
    const dup = kept.find(
      (k) =>
        k.row.kind === row.kind &&
        metersBetween(k.row, row) <= radiusM &&
        // Both names must keep a distinctive token, and share one.
        key.size > 0 &&
        [...key].some((t) => k.key.has(t)),
    );
    if (!dup) kept.push({ row, key });
  }
  return kept.map((k) => k.row);
}

/** Hospitals, health facilities, helipads and fire stations from BIPAD. */
export async function importFacilities(admin: Admin): Promise<ImportSummary> {
  const rows: Database["public"]["Tables"]["facilities"]["Insert"][] = [];
  for (const m of PILOT_AREA.municipalities) {
    const wards = await wardNumbers(m);
    for (const type of ["health", "helipad", "fireengine"] as const) {
      const items = await bipadList<BipadResource>(`/resource/?resource_type=${type}&municipality=${m.code}`);
      for (const r of items) {
        if (!r.point?.coordinates || !r.title?.trim()) continue;
        const [lng, lat] = r.point.coordinates;
        rows.push({
          kind: type === "health" ? (HOSPITAL_NAME.test(r.title) ? "hospital" : "health_facility") : type === "helipad" ? "helipad" : "fire_station",
          name: r.title.trim(),
          latitude: lat,
          longitude: lng,
          ward: r.ward ? (wards.get(r.ward) ?? null) : null,
          municipality: m.name,
          district: m.district,
          data_source: "BIPAD portal",
          source_ref: `bipad:resource:${r.id}`,
          is_active: true,
        });
      }
    }
  }
  const unique = dedupeFacilities(rows);
  for (let i = 0; i < unique.length; i += 500) {
    const { error } = await admin.from("facilities").upsert(unique.slice(i, i + 500), { onConflict: "source_ref" });
    if (error) throw new Error(`facilities: ${error.message}`);
  }
  // Drop BIPAD rows that are now duplicates or no longer published upstream.
  const keep = new Set(unique.map((r) => r.source_ref));
  const { data: existing } = await admin.from("facilities").select("id, source_ref").eq("data_source", "BIPAD portal");
  const stale = (existing ?? []).filter((r) => !keep.has(r.source_ref)).map((r) => r.id);
  for (let i = 0; i < stale.length; i += 200) {
    await admin.from("facilities").delete().in("id", stale.slice(i, i + 200));
  }
  const count = (k: string) => unique.filter((r) => r.kind === k).length;
  return {
    hospitals: count("hospital"),
    health_facilities: count("health_facility"),
    helipads: count("helipad"),
    fire_stations: count("fire_station"),
    duplicates_merged: rows.length - unique.length,
  };
}

type OverpassGeomMember = { type: string; role: string; geometry?: { lat: number; lon: number }[] };
type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
  members?: OverpassGeomMember[];
};

async function overpass(query: string): Promise<OverpassElement[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    const server = OVERPASS_SERVERS[attempt % OVERPASS_SERVERS.length];
    try {
      const data = await fetchJson<{ elements: OverpassElement[] }>(
        server,
        { method: "POST", body: new URLSearchParams({ data: query }), headers: { "Content-Type": "application/x-www-form-urlencoded" } },
        180_000,
      );
      return data.elements ?? [];
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Overpass API unavailable");
}

/** Joins a boundary relation's outer ways into closed rings; returns the largest. */
export function assembleOuterRing(members: OverpassGeomMember[]): [number, number][] {
  const ways = members
    .filter((m) => m.type === "way" && (m.role === "outer" || m.role === "") && m.geometry && m.geometry.length > 1)
    .map((m) => m.geometry!.map((p) => [p.lat, p.lon] as [number, number]));
  const same = (a: [number, number], b: [number, number]) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  const rings: [number, number][][] = [];
  const pool = [...ways];
  while (pool.length) {
    let ring = pool.shift()!;
    let extended = true;
    while (extended && !same(ring[0], ring[ring.length - 1])) {
      extended = false;
      for (let i = 0; i < pool.length; i++) {
        const w = pool[i];
        const end = ring[ring.length - 1];
        if (same(w[0], end)) ring = [...ring, ...w.slice(1)];
        else if (same(w[w.length - 1], end)) ring = [...ring, ...[...w].reverse().slice(1)];
        else continue;
        pool.splice(i, 1);
        extended = true;
        break;
      }
    }
    if (ring.length >= 4) rings.push(ring);
  }
  const area = (r: [number, number][]) =>
    Math.abs(r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[1] * q[0] - q[1] * p[0];
    }, 0)) / 2;
  return rings.sort((a, b) => area(b) - area(a))[0] ?? [];
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Ward boundaries (admin_level 9) for the pilot municipalities from OSM. */
export async function importWards(admin: Admin): Promise<ImportSummary> {
  const [s, w, n, e] = PILOT_AREA.bbox;
  const elements = await overpass(
    `[out:json][timeout:150];relation["boundary"="administrative"]["admin_level"="9"](${s},${w},${n},${e});out geom;`,
  );
  const rows: Database["public"]["Tables"]["wards"]["Insert"][] = [];
  for (const el of elements) {
    const name = el.tags?.name ?? "";
    const m = PILOT_AREA.municipalities.find((p) => name.startsWith(`${p.osmPrefix}-`));
    const wardNo = Number.parseInt(el.tags?.ward ?? name.split("-").pop() ?? "", 10);
    if (!m || !Number.isFinite(wardNo) || !el.members) continue;
    const ring = assembleOuterRing(el.members);
    if (ring.length < 4) continue;
    const lat = ring.reduce((a, p) => a + p[0], 0) / ring.length;
    const lng = ring.reduce((a, p) => a + p[1], 0) / ring.length;
    rows.push({
      id: `${slug(m.osmPrefix)}-${wardNo}`,
      municipality: m.name,
      district: m.district,
      ward_no: wardNo,
      name: `${m.name.replace(/ (Metropolitan City|Rural Municipality|Municipality)$/, "")}-${String(wardNo).padStart(2, "0")}`,
      polygon: ring.map(([la, lo]) => [Number(la.toFixed(6)), Number(lo.toFixed(6))]),
      center_latitude: lat,
      center_longitude: lng,
      data_source: "OpenStreetMap contributors (ODbL)",
      source_ref: `osm:relation:${el.id}`,
    });
  }
  const { error } = await admin.from("wards").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`wards: ${error.message}`);
  return { wards: rows.length };
}

/** Schools (BIPAD) and community centres / assembly points (OSM) as candidates. */
export async function importCandidateShelters(admin: Admin): Promise<ImportSummary> {
  let rows: Database["public"]["Tables"]["shelters"]["Insert"][] = [];
  for (const m of PILOT_AREA.municipalities) {
    const wards = await wardNumbers(m);
    const schools = await bipadList<BipadResource>(`/resource/?resource_type=education&municipality=${m.code}`);
    for (const r of schools) {
      if (!r.point?.coordinates || !r.title?.trim()) continue;
      const [lng, lat] = r.point.coordinates;
      const ward = r.ward ? (wards.get(r.ward) ?? null) : null;
      rows.push({
        name: r.title.trim(),
        address: [ward ? `Ward ${ward}` : null, m.name].filter(Boolean).join(", "),
        latitude: lat,
        longitude: lng,
        district: m.district,
        municipality: m.name,
        ward,
        capacity: 0,
        current_occupancy: 0,
        is_active: false,
        verification: "unverified",
        kind: "school",
        data_source: "BIPAD portal",
        source_ref: `bipad:resource:${r.id}`,
      });
    }
  }

  // Community centres and assembly points from OSM, labelled by nearest ward.
  const [s, w, n, e] = PILOT_AREA.bbox;
  const osm = await overpass(
    `[out:json][timeout:120];(nwr["amenity"="community_centre"](${s},${w},${n},${e});nwr["emergency"="assembly_point"](${s},${w},${n},${e});nwr["amenity"="shelter"]["shelter_type"!~"public_transport|picnic_shelter|weather_shelter|basic_hut|field_shelter"]["social_facility"](${s},${w},${n},${e}););out center tags;`,
  );
  const { data: wardRows } = await admin.from("wards").select("municipality, district, ward_no, center_latitude, center_longitude");
  const nearestWard = (lat: number, lng: number) =>
    (wardRows ?? []).reduce<{ d: number; w: (typeof wardRows extends (infer U)[] | null ? U : never) | null }>(
      (best, wr) => {
        const d = (wr.center_latitude - lat) ** 2 + (wr.center_longitude - lng) ** 2;
        return d < best.d ? { d, w: wr } : best;
      },
      { d: Infinity, w: null },
    ).w;
  for (const el of osm) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    const name = el.tags?.name ?? el.tags?.["name:en"];
    if (lat === undefined || lng === undefined || !name) continue;
    const ward = nearestWard(lat, lng);
    if (!ward) continue; // outside the pilot municipalities
    rows.push({
      name,
      address: `Ward ${ward.ward_no}, ${ward.municipality}`,
      latitude: lat,
      longitude: lng,
      district: ward.district,
      municipality: ward.municipality,
      ward: ward.ward_no,
      capacity: 0,
      current_occupancy: 0,
      is_active: false,
      verification: "unverified",
      kind: el.tags?.emergency === "assembly_point" ? "assembly_point" : "community_centre",
      data_source: "OpenStreetMap contributors (ODbL)",
      source_ref: `osm:${el.type}:${el.id}`,
    });
  }

  const unique = dedupeFacilities(rows, 60);
  // Remove duplicate candidates staff have never touched (still closed,
  // unverified, no capacity) — edited shelters are never deleted.
  const keep = new Set(unique.map((r) => r.source_ref));
  const { data: untouched } = await admin
    .from("shelters")
    .select("id, source_ref")
    .eq("verification", "unverified")
    .eq("is_active", false)
    .eq("capacity", 0)
    .not("source_ref", "is", null);
  const dupIds = (untouched ?? []).filter((r) => r.source_ref && !keep.has(r.source_ref)).map((r) => r.id);
  for (let i = 0; i < dupIds.length; i += 200) await admin.from("shelters").delete().in("id", dupIds.slice(i, i + 200));

  let inserted = 0;
  rows = unique;
  for (let i = 0; i < rows.length; i += 500) {
    // ignoreDuplicates: never overwrite a shelter staff may have verified/edited.
    const { data, error } = await admin
      .from("shelters")
      .upsert(rows.slice(i, i + 500), { onConflict: "source_ref", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(`shelters: ${error.message}`);
    inserted += data?.length ?? 0;
  }
  return { candidate_shelters: rows.length, candidate_shelters_new: inserted, candidate_duplicates_removed: dupIds.length };
}

/** Runs every import in dependency order (wards first, for shelter labels). */
export async function importReferenceData(admin: Admin): Promise<ImportSummary> {
  const wards = await importWards(admin);
  const facilities = await importFacilities(admin);
  const shelters = await importCandidateShelters(admin);
  return { ...wards, ...facilities, ...shelters };
}
