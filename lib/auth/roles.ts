/**
 * Pure role/authorization helpers (usable on server and client).
 * The role itself must always come from public.profiles on the server —
 * never from client input.
 */
import type { AppRole } from "@/types/domain";

export type AppArea = "citizen" | "citizen-account" | "dashboard" | "admin" | "rescue" | "demo";

const AREA_ROLES: Record<AppArea, readonly AppRole[]> = {
  /** Public citizen screens (home, map, route, shelters, SOS). */
  citizen: ["citizen", "operator", "rescue", "admin"],
  /** Citizen features that need a real (non-anonymous) account. */
  "citizen-account": ["citizen", "operator", "rescue", "admin"],
  dashboard: ["operator", "admin"],
  admin: ["admin"],
  /** Rescue teams use their own console; staff oversee every team's work there. */
  rescue: ["rescue", "operator", "admin"],
  demo: ["operator", "admin"],
};

export function canAccess(role: AppRole | null | undefined, area: AppArea): boolean {
  if (area === "citizen") return true;
  if (!role) return false;
  return AREA_ROLES[area].includes(role);
}

export function isStaffRole(role: AppRole | null | undefined): boolean {
  return role === "operator" || role === "admin";
}

/** Where a user lands after signing in. */
export function homeForRole(role: AppRole | null | undefined): string {
  switch (role) {
    case "operator":
    case "admin":
      return "/dashboard";
    case "rescue":
      return "/rescue";
    default:
      return "/citizen";
  }
}

/**
 * Only allow same-origin relative redirects (prevents open redirects via
 * ?next=https://evil.example).
 */
export function safeRedirectPath(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}

export const ROLE_LABEL: Record<AppRole, string> = {
  citizen: "Citizen",
  operator: "Emergency Operator",
  rescue: "Rescue Team",
  admin: "Administrator",
};
