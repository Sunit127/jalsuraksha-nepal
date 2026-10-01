import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authorize } from "@/lib/auth/session";
import { syncHydromet } from "@/lib/hydromet/sync";

/**
 * Runs a DHM/BIPAD sync now. Allowed for signed-in staff ("Sync now"), or for
 * a scheduler presenting CRON_SECRET (Vercel Cron sends it as a Bearer token;
 * Supabase pg_cron/pg_net can send the same header). Pages also sync lazily
 * when data is older than 10 minutes, so a scheduler is optional.
 */
export const maxDuration = 60;

function cronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(header.slice(7));
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: NextRequest) {
  if (!cronAuthorized(request)) {
    const auth = await authorize("dashboard");
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const summary = await syncHydromet();
  return NextResponse.json(summary, { status: summary.ok ? 200 : 502 });
}

export const GET = handle;
export const POST = handle;
