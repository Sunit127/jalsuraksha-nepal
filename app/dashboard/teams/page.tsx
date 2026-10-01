import type { Metadata } from "next";
import { authorize } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import TeamsPage from "./teams-view";

export const metadata: Metadata = { title: "Rescue teams" };

export default async function TeamsRoute() {
  const auth = await authorize("dashboard");
  const isAdmin = auth.ok && auth.session.role === "admin";
  const supabase = await createSupabaseServerClient();
  const { data: stations } = isAdmin
    ? await supabase.from("facilities").select("id, name, latitude, longitude, municipality").eq("kind", "fire_station").order("name")
    : { data: [] };
  return <TeamsPage isAdmin={isAdmin} fireStations={stations ?? []} />;
}
