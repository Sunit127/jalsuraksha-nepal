import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IncidentDetail } from "@/components/dashboard/incident-detail";
import { authorize } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/schemas";

export const metadata: Metadata = { title: "Incident" };

export default async function IncidentPage({ params }: PageProps<"/dashboard/incidents/[id]">) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const auth = await authorize("dashboard");
  if (!auth.ok) notFound();

  const supabase = await createSupabaseServerClient();
  const [{ data: sos }, { data: history }] = await Promise.all([
    supabase.from("sos_requests").select("id, photo_path").eq("id", id).maybeSingle(),
    supabase.from("incident_status_history").select("*").eq("sos_id", id).order("created_at"),
  ]);
  if (!sos) notFound();

  // Private SOS photos are shown to staff through a short-lived signed URL.
  let photoUrl: string | null = null;
  if (sos.photo_path) {
    try {
      const { data } = await createSupabaseAdminClient()
        .storage.from("sos-photos")
        .createSignedUrl(sos.photo_path, 60 * 30);
      photoUrl = data?.signedUrl ?? null;
    } catch (error) {
      console.error("[incident] signed URL failed", error);
    }
  }

  return <IncidentDetail sosId={id} initialHistory={history ?? []} photoUrl={photoUrl} />;
}
