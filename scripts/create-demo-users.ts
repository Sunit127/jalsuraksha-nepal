/**
 * Creates (or updates) the four hackathon demo accounts and assigns roles.
 * Idempotent — safe to run repeatedly.
 *
 *   npm run demo:users
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (or
 * SUPABASE_SERVICE_ROLE_KEY) and DEMO_ACCOUNT_PASSWORD in the environment
 * (.env.local is loaded automatically).
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
import { DEMO_ACCOUNTS } from "../lib/auth/demo-accounts";
import { DEMO_TEAM_R03_ID } from "../lib/demo/dataset";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_ACCOUNT_PASSWORD;

if (!url || !key || !password) {
  console.error(
    "Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and DEMO_ACCOUNT_PASSWORD are required.",
  );
  process.exit(1);
}
if (password.length < 8) {
  console.error("DEMO_ACCOUNT_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

const admin = createClient<Database>(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserIdByEmail(email: string): Promise<string | null> {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function main() {
  for (const [key, account] of Object.entries(DEMO_ACCOUNTS)) {
    let userId = await findUserIdByEmail(account.email);
    const attrs = {
      email: account.email,
      phone: account.phone.replace("+", ""),
      password,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: { full_name: account.fullName, demo: true },
    };

    if (userId) {
      const { error } = await admin.auth.admin.updateUserById(userId, attrs);
      if (error) throw new Error(`${key}: ${error.message}`);
    } else {
      const { data, error } = await admin.auth.admin.createUser(attrs);
      if (error) throw new Error(`${key}: ${error.message}`);
      userId = data.user.id;
    }

    // Service-role updates are allowed to set roles (auth.uid() is null).
    const { error: profileError } = await admin
      .from("profiles")
      .upsert({
        id: userId,
        full_name: account.fullName,
        phone: account.phone,
        role: account.role,
        district: "Chitwan",
        municipality: "Bharatpur Metropolitan City",
        ward: account.role === "citizen" ? 1 : null,
        emergency_contact: account.role === "citizen" ? "+9779800000002" : null,
        rescue_team_id: account.role === "rescue" ? DEMO_TEAM_R03_ID : null,
      });
    if (profileError) throw new Error(`${key} profile: ${profileError.message}`);

    console.log(`✓ ${account.label.padEnd(17)} ${account.email}  (${account.role})`);
  }
  console.log("\nDemo accounts ready. Use the demo buttons on /auth/login.");
}

main().catch((err) => {
  console.error("Failed to create demo users:", err instanceof Error ? err.message : err);
  process.exit(1);
});
