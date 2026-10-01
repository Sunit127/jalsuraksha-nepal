import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDemoDataset, DEMO_IDS } from "@/lib/demo/dataset";
import { DEMO_BRIDGE } from "@/lib/demo/scenario";
import type { Database } from "@/types/database.types";

type Admin = SupabaseClient<Database>;

/** Fixed id so "flood the bridge" is idempotent. */
export const DEMO_BRIDGE_HAZARD_ID = DEMO_IDS.hazard(99);

export async function blockDemoBridge(admin: Admin) {
  return admin.from("hazard_reports").upsert({
    id: DEMO_BRIDGE_HAZARD_ID,
    type: "blocked_bridge",
    severity: "critical",
    status: "verified",
    description: "Bridge deck under water (demo scenario). Do not cross.",
    location_name: DEMO_BRIDGE.locationName,
    latitude: DEMO_BRIDGE.lat,
    longitude: DEMO_BRIDGE.lng,
    confirmation_count: 3,
    source_type: "simulated",
    created_at: new Date().toISOString(),
  });
}

export async function clearDemoBridge(admin: Admin) {
  return admin.from("hazard_reports").update({ status: "resolved" }).eq("id", DEMO_BRIDGE_HAZARD_ID);
}

/**
 * Restores the simulated dataset: removes all incidents, hazards and alerts
 * (including ones created during a rehearsal) and re-inserts the seed rows
 * with timestamps relative to now. Teams, shelters and zones are upserted so
 * user accounts linked to teams keep working.
 */
export async function resetDemoData(admin: Admin) {
  const now = Date.now();
  const data = buildDemoDataset((minutesAgo) => new Date(now - minutesAgo * 60_000).toISOString());
  const ALL = "00000000-0000-0000-0000-000000000000";

  const run = async (label: string, p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p;
    if (error) throw new Error(`${label}: ${error.message}`);
  };

  // Order matters because of foreign keys.
  await run("delete sos", admin.from("sos_requests").delete().neq("id", ALL));
  await run("delete hazards", admin.from("hazard_reports").delete().neq("id", ALL));
  await run("delete alerts", admin.from("alerts").delete().neq("id", ALL));

  await run("upsert teams", admin.from("rescue_teams").upsert(data.rescue_teams));
  await run("upsert zones", admin.from("risk_zones").upsert(data.risk_zones));
  await run("upsert shelters", admin.from("shelters").upsert(data.shelters));
  await run("insert alerts", admin.from("alerts").insert(data.alerts));
  // Primary reports first, then grouped duplicates that reference them.
  await run("insert hazards", admin.from("hazard_reports").insert(data.hazard_reports.filter((h) => !h.duplicate_of)));
  await run("insert duplicate hazards", admin.from("hazard_reports").insert(data.hazard_reports.filter((h) => h.duplicate_of)));
  await run("insert sos", admin.from("sos_requests").insert(data.sos_requests));
  await run(
    "clear auto history",
    admin.from("incident_status_history").delete().in("sos_id", data.sos_requests.map((s) => s.id!)),
  );
  await run("insert history", admin.from("incident_status_history").insert(data.incident_status_history));
  // The scripted scenario (DANGER 84, flooded bridge) needs simulated readings;
  // every screen then shows a SIMULATION banner until staff switch back to live.
  await run("simulation mode", admin.from("app_settings").upsert({ key: "data_mode", value: "simulation" }));
  await run("insert assignments", admin.from("rescue_assignments").insert(data.rescue_assignments));

  return {
    sos: data.sos_requests.length,
    hazards: data.hazard_reports.length,
    alerts: data.alerts.length,
  };
}
