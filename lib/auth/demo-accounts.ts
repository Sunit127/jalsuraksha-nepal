/**
 * Demo account identities (no secrets). The shared password lives only in the
 * server environment variable DEMO_ACCOUNT_PASSWORD.
 */
import type { AppRole } from "@/types/domain";

export type DemoAccountKey = "citizen" | "operator" | "rescue" | "admin";

export const DEMO_ACCOUNTS: Record<
  DemoAccountKey,
  { email: string; phone: string; fullName: string; role: AppRole; label: string; description: string }
> = {
  citizen: {
    email: "citizen@demo.jalsuraksha.np",
    phone: "+9779800000001",
    fullName: "Sita Shrestha",
    role: "citizen",
    label: "Citizen Demo",
    description: "Bharatpur-1 resident",
  },
  operator: {
    email: "operator@demo.jalsuraksha.np",
    phone: "+9779800000011",
    fullName: "Ramesh Adhikari",
    role: "operator",
    label: "Operator Demo",
    description: "Emergency Operations Centre",
  },
  rescue: {
    email: "rescue@demo.jalsuraksha.np",
    phone: "+9779800000021",
    fullName: "Team Lead Bikash Thapa",
    role: "rescue",
    label: "Rescue Team Demo",
    description: "Team R-03",
  },
  admin: {
    email: "admin@demo.jalsuraksha.np",
    phone: "+9779800000031",
    fullName: "Anita Gurung",
    role: "admin",
    label: "Admin Demo",
    description: "System administrator",
  },
};

export const DEMO_ACCOUNT_KEYS = Object.keys(DEMO_ACCOUNTS) as DemoAccountKey[];
