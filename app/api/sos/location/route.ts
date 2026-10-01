import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/utilities/rate-limit";
import { sosLocationUpdateSchema } from "@/lib/validation/schemas";

/**
 * Live caller position while an SOS is open (proven by its tracking token).
 * The control centre's map follows it through Realtime on sos_requests.
 */
export async function POST(request: NextRequest) {
  const limit = rateLimit(`sos-location:${clientIp(request.headers)}`, 30, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const parsed = sosLocationUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid position." }, { status: 400 });
  const v = parsed.data;

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("update_sos_location_with_token", {
      p_reference: v.ref,
      p_token: v.token,
      p_latitude: v.latitude,
      p_longitude: v.longitude,
      p_accuracy_m: v.accuracyM === undefined ? (null as unknown as number) : Math.round(Math.min(v.accuracyM, 100_000)),
    });
    if (error) {
      const notFound = error.message.startsWith("NOT_FOUND");
      if (!notFound) console.error("[api/sos/location] failed", error.message);
      return NextResponse.json(
        { error: notFound ? "SOS not found." : "Could not update the location." },
        { status: notFound ? 404 : 500 },
      );
    }
    return NextResponse.json({ status: data?.status, updatedAt: data?.location_updated_at });
  } catch (error) {
    console.error("[api/sos/location] failed", error);
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }
}
