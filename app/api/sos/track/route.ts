import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { valhallaRoute } from "@/lib/routing/valhalla";
import { haversineMeters } from "@/lib/utilities/geo";
import { clientIp, rateLimit } from "@/lib/utilities/rate-limit";
import { sosTrackQuerySchema } from "@/lib/validation/schemas";

/** A team position older than this is not shown as "live". */
const TEAM_POSITION_MAX_AGE_MS = 30 * 60_000;
const ACTIVE_ASSIGNMENT = ["assigned", "accepted", "en_route", "arrived", "in_progress"];

/** Road ETA cache: one Valhalla call per team position, not per poll. */
const etaCache = new Map<string, { at: number; value: { distanceM: number; minutes: number } | null }>();

async function roadEta(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const base = process.env.VALHALLA_URL;
  if (!base) return null;
  const key = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}>${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  const hit = etaCache.get(key);
  if (hit && Date.now() - hit.at < 120_000) return hit.value;
  let value: { distanceM: number; minutes: number } | null = null;
  try {
    // Driving time on roads: rescue vehicles; boats/foot may differ (labelled approximate).
    const leg = await valhallaRoute(base, from, to, [], fetch, "auto");
    value = leg ? { distanceM: Math.round(leg.lengthM), minutes: Math.max(1, Math.round(leg.timeS / 60)) } : null;
  } catch {
    value = null;
  }
  if (etaCache.size > 500) etaCache.clear();
  etaCache.set(key, { at: Date.now(), value });
  return value;
}

/**
 * Token-based SOS status for the citizen tracking screen. Works without a
 * session (guests) and doubles as the polling fallback when realtime drops.
 * Returns only what the requester needs — never other people's data.
 */
export async function GET(request: NextRequest) {
  const limit = rateLimit(`track:${clientIp(request.headers)}`, 120, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const parsed = sosTrackQuerySchema.safeParse({
    ref: request.nextUrl.searchParams.get("ref"),
    token: request.nextUrl.searchParams.get("token"),
  });
  if (!parsed.success) return NextResponse.json({ error: "SOS not found." }, { status: 404 });

  try {
    const admin = createSupabaseAdminClient();
    const { data: sos } = await admin
      .from("sos_requests")
      .select(
        "id, reference_code, status, priority_score, priority_level, priority_factors, operator_priority_override, effective_priority, people_count, children_count, elderly_count, injured, situation, latitude, longitude, location_name, created_at, updated_at, assigned_team_id, user_id",
      )
      .eq("reference_code", parsed.data.ref)
      .eq("tracking_token", parsed.data.token)
      .maybeSingle();

    if (!sos) return NextResponse.json({ error: "SOS not found." }, { status: 404 });

    const [{ data: history }, { data: assignment }] = await Promise.all([
      admin
        .from("incident_status_history")
        .select("to_status, note, created_at")
        .eq("sos_id", sos.id)
        .order("created_at", { ascending: true }),
      admin
        .from("rescue_assignments")
        .select("status, assigned_at, accepted_at, en_route_at, arrived_at, completed_at, rescue_team_id, rescue_teams(call_sign, name, personnel_count, equipment, latitude, longitude, contact_phone)")
        .eq("sos_id", sos.id)
        .order("assigned_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const here = { lat: sos.latitude, lng: sos.longitude };
    const open = !["resolved", "cancelled"].includes(sos.status);

    // The assigned team's live position — only during an active mission.
    let teamLocation: { latitude: number; longitude: number; accuracyM: number | null; headingDeg: number | null; updatedAt: string; distanceM: number; road: { distanceM: number; minutes: number } | null } | null = null;
    if (open && assignment && ACTIVE_ASSIGNMENT.includes(assignment.status)) {
      const { data: loc } = await admin.from("team_locations").select("*").eq("team_id", assignment.rescue_team_id).maybeSingle();
      if (loc && Date.now() - new Date(loc.updated_at).getTime() <= TEAM_POSITION_MAX_AGE_MS) {
        const pos = { lat: loc.latitude, lng: loc.longitude };
        teamLocation = {
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracyM: loc.accuracy_m,
          headingDeg: loc.heading_deg,
          updatedAt: loc.updated_at,
          distanceM: Math.round(haversineMeters(pos, here)),
          road: assignment.status === "arrived" || assignment.status === "in_progress" ? null : await roadEta(pos, here),
        };
      }
    }

    // Nearest safe places (public data), for the person while they wait.
    const [{ data: shelterRows }, { data: hospitalRows }] = await Promise.all([
      admin
        .from("shelters")
        .select("id, name, address, latitude, longitude, remaining_capacity, capacity, contact_phone, is_demo, verification")
        .eq("is_active", true)
        .gt("remaining_capacity", 0),
      admin.from("facilities").select("id, name, latitude, longitude, phone").eq("kind", "hospital").eq("is_active", true),
    ]);
    const nearest = <T extends { latitude: number; longitude: number }>(rows: T[] | null, n: number) =>
      (open ? (rows ?? []) : [])
        .map((r) => ({ ...r, distanceM: Math.round(haversineMeters(here, { lat: r.latitude, lng: r.longitude })) }))
        .sort((a, b) => a.distanceM - b.distanceM)
        .slice(0, n);

    const { user_id, ...publicSos } = sos;
    const { rescue_team_id: _team, ...publicAssignment } = assignment ?? ({} as NonNullable<typeof assignment>);
    void _team;
    return NextResponse.json(
      {
        sos: { ...publicSos, has_owner: Boolean(user_id) },
        history: history ?? [],
        assignment: assignment ? publicAssignment : null,
        teamLocation,
        safePlaces: { shelters: nearest(shelterRows, 3), hospitals: nearest(hospitalRows, 2) },
        fetchedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[api/sos/track] failed", error);
    return NextResponse.json({ error: "Status temporarily unavailable." }, { status: 503 });
  }
}
