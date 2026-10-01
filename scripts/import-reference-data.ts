/**
 * Imports real reference data for the pilot area (wards, hospitals/health
 * facilities, helipads, fire stations, candidate shelters).
 *
 *   npm run data:import
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (from .env.local).
 */
import { createClient } from "@supabase/supabase-js";
import { importReferenceData } from "@/lib/services/reference-data";
import type { Database } from "@/types/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
  process.exit(1);
}

async function main() {
  const admin = createClient<Database>(url!, key!, { auth: { persistSession: false } });
  console.log("Importing reference data (BIPAD portal + OpenStreetMap)… this takes about a minute.");
  const summary = await importReferenceData(admin);
  for (const [k, v] of Object.entries(summary)) console.log(`  ${k.padEnd(24)} ${v}`);
  console.log("Done. Candidate shelters are closed and unverified until staff confirm them.");
}

main().catch((error) => {
  console.error("Import failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
