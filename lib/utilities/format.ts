import type { HazardType } from "@/types/domain";

export function timeAgo(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 0) {
    const ahead = -seconds;
    if (ahead < 3600) return `in ${Math.max(1, Math.round(ahead / 60))} min`;
    if (ahead < 86400) return `in ${Math.round(ahead / 3600)} h`;
    return `in ${Math.round(ahead / 86400)} d`;
  }
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min ago`;
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const d = Math.floor(seconds / 86400);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export function formatClock(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kathmandu",
  });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kathmandu",
  });
}

export const HAZARD_TYPE_LABEL: Record<HazardType, string> = {
  flooded_road: "Flooded road",
  landslide: "Landslide",
  blocked_bridge: "Blocked bridge",
  waterlogging: "Waterlogging",
  damaged_infrastructure: "Damaged infrastructure",
  stranded_people: "Stranded people",
  other: "Other hazard",
};

/** Display phone numbers as "+977 98XX-XXXXXX". */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const m = phone.match(/^\+?977(\d{3})(\d{7})$/);
  if (m) return `+977 ${m[1]}-${m[2]}`;
  return phone;
}

