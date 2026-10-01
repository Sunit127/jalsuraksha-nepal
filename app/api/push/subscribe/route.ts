import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth/session";
import { pushConfigured } from "@/lib/services/push";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/utilities/rate-limit";
import { pushSubscriptionSchema } from "@/lib/validation/schemas";

/**
 * Saves (POST) or removes (DELETE) this device's push subscription for
 * lock-screen flood alerts. Guests may subscribe; a signed-in user is linked.
 */
export async function POST(request: NextRequest) {
  if (!pushConfigured()) return NextResponse.json({ error: "Push alerts are not enabled." }, { status: 404 });
  const limit = rateLimit(`push:${clientIp(request.headers)}`, 20, 10 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const parsed = pushSubscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });

  const session = await getSessionContext();
  try {
    const { error } = await createSupabaseAdminClient()
      .from("push_subscriptions")
      .upsert(
        {
          endpoint: parsed.data.endpoint,
          p256dh: parsed.data.keys.p256dh,
          auth: parsed.data.keys.auth,
          user_id: session.userId && !session.isAnonymous ? session.userId : null,
        },
        { onConflict: "endpoint" },
      );
    if (error) {
      console.error("[api/push] save failed", error.message);
      return NextResponse.json({ error: "Could not turn on alerts." }, { status: 500 });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("[api/push] save failed", error);
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const limit = rateLimit(`push:${clientIp(request.headers)}`, 20, 10 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const parsed = z.object({ endpoint: z.string().max(1000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    await createSupabaseAdminClient().from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/push] delete failed", error);
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }
}
