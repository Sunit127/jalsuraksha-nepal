import type { Metadata } from "next";
import { DataSourcesView, type ReferenceCounts } from "@/components/dashboard/data-sources-view";
import { authorize } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Data sources" };
export const dynamic = "force-dynamic";

export default async function DataSourcesPage() {
  const auth = await authorize("dashboard");
  const supabase = await createSupabaseServerClient();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const facilities = (kind: "hospital" | "health_facility" | "helipad" | "fire_station") =>
    count(supabase.from("facilities").select("id", { count: "exact", head: true }).eq("kind", kind));

  const counts: ReferenceCounts = {
    wards: await count(supabase.from("wards").select("id", { count: "exact", head: true })),
    hospitals: await facilities("hospital"),
    healthFacilities: await facilities("health_facility"),
    helipads: await facilities("helipad"),
    fireStations: await facilities("fire_station"),
    sheltersOpen: await count(supabase.from("shelters").select("id", { count: "exact", head: true }).eq("is_active", true)),
    sheltersVerified: await count(supabase.from("shelters").select("id", { count: "exact", head: true }).eq("verification", "verified")),
    sheltersCandidates: await count(supabase.from("shelters").select("id", { count: "exact", head: true }).eq("verification", "unverified")),
    sheltersDemo: await count(supabase.from("shelters").select("id", { count: "exact", head: true }).eq("verification", "demo")),
  };

  return <DataSourcesView counts={counts} isAdmin={auth.ok && auth.session.role === "admin"} />;
}
