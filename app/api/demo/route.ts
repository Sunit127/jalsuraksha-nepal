import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/session";
import { blockDemoBridge, clearDemoBridge, resetDemoData } from "@/lib/services/demo";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DEMO_MODE } from "@/lib/supabase/env";
import { clientIp, rateLimit } from "@/lib/utilities/rate-limit";

const bodySchema = z.object({ action: z.enum(["block_bridge", "clear_bridge", "reset"]) });

/**
 * Presentation controls. Disabled unless NEXT_PUBLIC_DEMO_MODE=true.
 * - block_bridge / clear_bridge: toggles one fixed, simulated hazard so the
 *   presenter can trigger re-routing from the citizen screen.
 * - reset: restores the whole simulated dataset (operators/admins only).
 */
export async function POST(request: NextRequest) {
  if (!DEMO_MODE) return NextResponse.json({ error: "Demo mode is disabled." }, { status: 404 });

  const limit = rateLimit(`demo:${clientIp(request.headers)}`, 30, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Slow down." }, { status: 429 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  try {
    const admin = createSupabaseAdminClient();
    if (parsed.data.action === "reset") {
      const auth = await authorize("demo");
      if (!auth.ok) return NextResponse.json({ error: "Operators only." }, { status: 403 });
      const counts = await resetDemoData(admin);
      return NextResponse.json({ ok: true, message: `Demo data restored (${counts.sos} incidents, ${counts.hazards} hazards).` });
    }

    const { error } =
      parsed.data.action === "block_bridge" ? await blockDemoBridge(admin) : await clearDemoBridge(admin);
    if (error) throw new Error(error.message);
    return NextResponse.json({
      ok: true,
      message: parsed.data.action === "block_bridge" ? "Riverside Link Bridge reported flooded." : "Bridge hazard cleared.",
    });
  } catch (error) {
    console.error("[api/demo] failed", error);
    return NextResponse.json({ error: "Demo action failed." }, { status: 500 });
  }
}
