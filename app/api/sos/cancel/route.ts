import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/utilities/rate-limit";
import { sosTrackQuerySchema } from "@/lib/validation/schemas";

/** "I am safe now" — closes the caller's SOS (proven by its tracking token). */
export async function POST(request: NextRequest) {
  const limit = rateLimit(`cancel:${clientIp(request.headers)}`, 20, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = sosTrackQuerySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "SOS not found." }, { status: 404 });

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("cancel_sos_with_token", {
      p_reference: parsed.data.ref,
      p_token: parsed.data.token,
    });
    if (error) {
      const notFound = error.message.startsWith("NOT_FOUND");
      if (!notFound) console.error("[api/sos/cancel] failed", error.message);
      return NextResponse.json(
        { error: notFound ? "SOS not found." : "Could not update your SOS. Please try again." },
        { status: notFound ? 404 : 500 },
      );
    }
    return NextResponse.json({ status: data?.status ?? "cancelled" });
  } catch (error) {
    console.error("[api/sos/cancel] failed", error);
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }
}
