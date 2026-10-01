import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth/session";
import { DEMO_ACCOUNTS } from "@/lib/auth/demo-accounts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DEMO_MODE, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Check = { ok: boolean; detail: string };

/**
 * Health / pre-demo readiness check.
 * - Public: { ok, time } only (safe for uptime monitors).
 * - Operators/admins: every check with a human-readable detail. Values of
 *   secrets are never returned — only whether they are present.
 */
export async function GET() {
  const checks: Record<string, Check> = {};
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  checks.env = {
    ok: Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY && secretKey && (!DEMO_MODE || process.env.DEMO_ACCOUNT_PASSWORD)),
    detail: [
      `NEXT_PUBLIC_SUPABASE_URL ${SUPABASE_URL ? "set" : "MISSING"}`,
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ${SUPABASE_PUBLISHABLE_KEY ? "set" : "MISSING"}`,
      `SUPABASE_SECRET_KEY ${secretKey ? "set" : "MISSING"}`,
      `DEMO_MODE ${DEMO_MODE ? "on" : "off"}`,
      DEMO_MODE ? `DEMO_ACCOUNT_PASSWORD ${process.env.DEMO_ACCOUNT_PASSWORD ? "set" : "MISSING"}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  };

  // Public read path (as an anonymous visitor would see it).
  try {
    const started = Date.now();
    const supabase = await createSupabaseServerClient();
    const { count, error } = await supabase.from("shelters").select("id", { count: "exact", head: true });
    checks.database = error
      ? { ok: false, detail: `Query failed: ${error.message}` }
      : { ok: true, detail: `Reachable in ${Date.now() - started} ms · ${count ?? 0} shelters readable` };
  } catch (error) {
    checks.database = { ok: false, detail: error instanceof Error ? error.message : "Unreachable" };
  }

  if (secretKey && SUPABASE_URL) {
    try {
      const admin = createSupabaseAdminClient();
      const [zones, teams, alerts, profiles] = await Promise.all([
        admin.from("risk_zones").select("id", { count: "exact", head: true }),
        admin.from("rescue_teams").select("id, call_sign, status"),
        admin.from("alerts").select("id", { count: "exact", head: true }).eq("is_active", true),
        admin.from("profiles").select("role, rescue_team_id").in("role", ["operator", "rescue", "admin"]),
      ]);
      const r03 = teams.data?.find((t) => t.call_sign === "R-03");
      checks.seedData = {
        ok: (zones.count ?? 0) > 0 && (teams.data?.length ?? 0) > 0,
        detail: `${zones.count ?? 0} risk zones · ${teams.data?.length ?? 0} rescue teams · ${alerts.count ?? 0} active alerts`,
      };
      checks.demoTeam = {
        ok: r03?.status === "available",
        detail: r03 ? `Team R-03 is ${r03.status}${r03.status === "available" ? "" : " — reset demo data before presenting"}` : "Team R-03 not found — load supabase/seed.sql",
      };
      if (DEMO_MODE) {
        const roles = profiles.data ?? [];
        const rescueLinked = roles.some((p) => p.role === "rescue" && p.rescue_team_id === r03?.id);
        checks.demoAccounts = {
          ok: roles.some((p) => p.role === "operator") && roles.some((p) => p.role === "admin") && rescueLinked,
          detail: rescueLinked
            ? `Operator, admin and rescue (R-03) accounts present (${Object.keys(DEMO_ACCOUNTS).length} demo accounts expected)`
            : "Demo staff accounts missing or rescue not linked to R-03 — run `npm run demo:users`",
        };
      }
    } catch (error) {
      checks.seedData = { ok: false, detail: error instanceof Error ? error.message : "Admin client failed" };
    }
  }

  // ok = the service works; ready = additionally in a clean state for a demo.
  const CORE = ["env", "database", "seedData"];
  const ok = CORE.every((k) => checks[k]?.ok !== false);
  const ready = Object.values(checks).every((c) => c.ok);
  const auth = await authorize("dashboard").catch(() => null);
  const time = new Date().toISOString();
  const body = auth?.ok ? { ok, ready, time, checks } : { ok, time };
  return NextResponse.json(body, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
