import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createSosRequest } from "@/lib/services/sos-intake";
import { clientIp, rateLimit } from "@/lib/utilities/rate-limit";
import { firstIssue, sosFormSchema } from "@/lib/validation/schemas";

/**
 * Guest-capable SOS intake. No account required: if the browser has a
 * (possibly anonymous) Supabase session, the SOS is linked to it so the person
 * receives realtime updates; otherwise the tracking token is the fallback.
 */
export async function POST(request: NextRequest) {
  const limit = rateLimit(`sos:${clientIp(request.headers)}`, 6, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many SOS requests from this device. If you are in danger, call 100 or 102." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterS) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = sosFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 422 });
  }

  const session = await getSessionContext();
  try {
    const result = await createSosRequest(parsed.data, { userId: session.userId, source: "app" });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    console.error("[api/sos] failed", error);
    return NextResponse.json(
      { error: "The SOS service is temporarily unavailable. Please call 100 or 102." },
      { status: 503 },
    );
  }
}
