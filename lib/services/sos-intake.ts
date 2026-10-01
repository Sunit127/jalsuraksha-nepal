import "server-only";

import { calculateSosPriority, type SosPriorityResult } from "@/lib/risk-engine/sos-priority";
import { applyLiveReadings } from "@/lib/hydromet/live";
import { scoreZones, zoneForPoint } from "@/lib/risk-engine/zones";
import { parsePolygon, pointInPolygon } from "@/lib/utilities/geo";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SosFormValues } from "@/lib/validation/schemas";

/** One open SOS per phone number within this window returns the existing one. */
export const DUPLICATE_WINDOW_MINUTES = 10;

export type SosIntakeResult =
  | {
      ok: true;
      duplicate: false;
      id: string;
      reference: string;
      trackingToken: string;
      priority: SosPriorityResult;
      zoneName: string | null;
    }
  | {
      ok: true;
      duplicate: true;
      reference: string;
      /** Only returned when the same signed-in/anonymous user owns it. */
      trackingToken: string | null;
    }
  | { ok: false; error: string };

/**
 * Creates an SOS request. Runs server-side with the admin client because
 * guests may have no session; callers MUST validate input first.
 */
export async function createSosRequest(
  input: SosFormValues,
  ctx: { userId: string | null; source: "app" | "sms" | "operator" },
): Promise<SosIntakeResult> {
  const admin = createSupabaseAdminClient();

  // Duplicate protection: an open SOS from the same phone in the last minutes.
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60_000).toISOString();
  const { data: existing } = await admin
    .from("sos_requests")
    .select("id, reference_code, tracking_token, user_id")
    .eq("phone", input.phone)
    .not("status", "in", "(resolved,cancelled)")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const owns = ctx.userId !== null && existing.user_id === ctx.userId;
    return {
      ok: true,
      duplicate: true,
      reference: existing.reference_code,
      trackingToken: owns ? existing.tracking_token : null,
    };
  }

  // Risk context: is the location inside a mapped HIGH/DANGER zone? Uses the
  // same live DHM readings (or labelled simulation) as the citizen app.
  const point = { lat: input.latitude, lng: input.longitude };
  const [{ data: zones }, { data: hazards }, { data: stations }, { data: mode }, { data: wards }] = await Promise.all([
    admin.from("risk_zones").select("*"),
    admin
      .from("hazard_reports")
      .select("latitude, longitude, status, duplicate_of, source_type")
      .in("status", ["open", "verified"]),
    admin.from("hydromet_stations").select("*"),
    admin.from("app_settings").select("value").eq("key", "data_mode").maybeSingle(),
    admin
      .from("wards")
      .select("name, polygon")
      .lte("center_latitude", input.latitude + 0.1)
      .gte("center_latitude", input.latitude - 0.1)
      .lte("center_longitude", input.longitude + 0.1)
      .gte("center_longitude", input.longitude - 0.1),
  ]);
  const dataMode = mode?.value === "simulation" ? "simulation" : "live";
  const zone = zoneForPoint(point, scoreZones(applyLiveReadings(zones ?? [], stations ?? [], dataMode), hazards ?? []));
  const ward = (wards ?? []).find((w) => pointInPolygon(point, parsePolygon(w.polygon)));

  const priority = calculateSosPriority({
    situation: input.situation,
    injured: input.injured,
    peopleCount: input.peopleCount,
    childrenCount: input.childrenCount,
    elderlyCount: input.elderlyCount,
    zoneRisk: zone?.risk.category ?? null,
  });

  const { data, error } = await admin
    .from("sos_requests")
    .insert({
      user_id: ctx.userId,
      phone: input.phone,
      latitude: input.latitude,
      longitude: input.longitude,
      location_accuracy_m: input.locationAccuracyM ?? null,
      location_name: input.locationName ?? ward?.name ?? zone?.name ?? null,
      people_count: input.peopleCount,
      children_count: input.childrenCount,
      elderly_count: input.elderlyCount,
      injured: input.injured,
      situation: input.situation,
      description: input.description ?? null,
      photo_path: input.photoPath ?? null,
      priority_score: priority.score,
      priority_level: priority.level,
      priority_factors: priority.factors,
      source: ctx.source,
    })
    .select("id, reference_code, tracking_token")
    .single();

  if (error || !data) {
    console.error("[sos] insert failed", error?.message);
    return { ok: false, error: "We could not record your SOS. Please try again or call 100 / 102." };
  }

  return {
    ok: true,
    duplicate: false,
    id: data.id,
    reference: data.reference_code,
    trackingToken: data.tracking_token,
    priority,
    zoneName: zone?.name ?? null,
  };
}
