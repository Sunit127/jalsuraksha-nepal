import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/utilities/rate-limit";

/**
 * The signed-in person's own SOS requests from the last 24 h, with their
 * tracking codes, so the account can follow its SOS on any device (not only
 * the browser that sent it). Includes anonymous guest sessions.
 */
export async function GET(request: NextRequest) {
  const limit = rateLimit(`sos-mine:${clientIp(request.headers)}`, 60, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const session = await getSessionContext();
  if (!session.userId) return NextResponse.json({ sos: [] }, { headers: { "Cache-Control": "no-store" } });

  try {
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { data, error } = await createSupabaseAdminClient()
      .from("sos_requests")
      .select("reference_code, tracking_token, created_at")
      .eq("user_id", session.userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return NextResponse.json(
      { sos: (data ?? []).map((s) => ({ ref: s.reference_code, token: s.tracking_token, createdAt: s.created_at })) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[api/sos/mine] failed", error);
    return NextResponse.json({ error: "Temporarily unavailable." }, { status: 503 });
  }
}
