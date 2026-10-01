import { inPilotBbox } from "@/lib/geo/pilot-area";
import type { Database } from "@/types/database.types";

type ShelterInsert = Database["public"]["Tables"]["shelters"]["Insert"];

/** Splits one CSV line, honouring double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"' && quoted) {
      cur += '"';
      i++;
    } else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/**
 * Official shelter list → verified, open shelter rows. Required columns:
 * name, latitude, longitude, capacity. Optional: ward, municipality,
 * district, address, phone. Coordinates must lie in the pilot area.
 */
export function parseShelterCsv(csv: string): { ok: true; rows: ShelterInsert[] } | { ok: false; error: string } {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { ok: false, error: "The file needs a header row and at least one shelter." };
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const col = (name: string) => header.indexOf(name);
  for (const required of ["name", "latitude", "longitude", "capacity"]) {
    if (col(required) === -1) return { ok: false, error: `Missing column "${required}". Expected: name,latitude,longitude,capacity[,ward,municipality,district,address,phone]` };
  }
  if (lines.length > 2001) return { ok: false, error: "At most 2,000 shelters per file." };
  const rows: ShelterInsert[] = [];
  for (let i = 1; i < lines.length; i++) {
    const f = splitCsvLine(lines[i]);
    const get = (name: string) => (col(name) >= 0 ? (f[col(name)] ?? "").trim() : "");
    const name = get("name");
    const lat = Number(get("latitude"));
    const lng = Number(get("longitude"));
    const capacity = Math.round(Number(get("capacity")));
    if (!name) return { ok: false, error: `Row ${i + 1}: name is empty.` };
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inPilotBbox(lat, lng)) return { ok: false, error: `Row ${i + 1} (${name}): coordinates are missing or outside the pilot area.` };
    if (!Number.isFinite(capacity) || capacity < 1) return { ok: false, error: `Row ${i + 1} (${name}): capacity must be a positive number.` };
    const ward = Number.parseInt(get("ward"), 10);
    const municipality = get("municipality") || "Unknown municipality";
    rows.push({
      name: name.slice(0, 200),
      latitude: lat,
      longitude: lng,
      capacity,
      current_occupancy: 0,
      ward: Number.isFinite(ward) ? ward : null,
      municipality,
      district: get("district") || "Chitwan",
      address: get("address") || [Number.isFinite(ward) ? `Ward ${ward}` : null, municipality].filter(Boolean).join(", "),
      contact_phone: get("phone") || null,
      is_active: true,
      verification: "verified",
      kind: "evacuation_centre",
      data_source: "Official shelter list (CSV)",
      source_ref: `csv:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${lat.toFixed(4)},${lng.toFixed(4)}`,
    });
  }
  return { ok: true, rows };
}
