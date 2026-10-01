import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { findRealSafeRoute } from "@/lib/routing/valhalla";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/utilities/rate-limit";
import { latitudeSchema, longitudeSchema, uuidSchema } from "@/lib/validation/schemas";

/**
 * Hazard-aware evacuation route over real OpenStreetMap roads (self-hosted
 * Valhalla). Shelters and hazards are read server-side (public data), so the
 * client cannot inject fake ones. 503 { fallback: true } tells the app to use
 * its offline demo network instead.
 */
const bodySchema = z.object({
  from: z.object({ lat: latitudeSchema, lng: longitudeSchema }),
  shelterId: uuidSchema.nullish(),
  avoidHazardIds: z.array(uuidSchema).max(10).optional(),
});

export async function POST(request: NextRequest) {
  const baseUrl = process.env.VALHALLA_URL;
  if (!baseUrl) return NextResponse.json({ fallback: true, reason: "Routing service not configured." }, { status: 503 });

  const limit = rateLimit(`route:${clientIp(request.headers)}`, 60, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many route requests." }, { status: 429 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const [{ data: shelters }, { data: hazards }, { data: mode }] = await Promise.all([
    supabase.from("shelters").select("id, name, latitude, longitude, remaining_capacity, capacity, current_occupancy, is_active").eq("is_active", true),
    supabase
      .from("hazard_reports")
      .select("id, type, severity, status, latitude, longitude, location_name, duplicate_of, source_type")
      .in("status", ["open", "verified"])
      .gte("created_at", new Date(Date.now() - 72 * 3600_000).toISOString()),
    supabase.from("app_settings").select("value").eq("key", "data_mode").maybeSingle(),
  ]);
  // Live mode routes around real reports only (never demo content).
  const live = mode?.value !== "simulation";
  const routeHazards = (hazards ?? []).filter((h) => !live || h.source_type !== "simulated");

  try {
    const result = await findRealSafeRoute(baseUrl, {
      from: body.data.from,
      shelters: shelters ?? [],
      hazards: routeHazards,
      shelterId: body.data.shelterId ?? null,
      avoidHazardIds: body.data.avoidHazardIds ?? [],
    });
    return NextResponse.json({ engine: "valhalla", result });
  } catch (error) {
    console.error("[route] valhalla failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ fallback: true, reason: "Routing service unavailable." }, { status: 503 });
  }
}
