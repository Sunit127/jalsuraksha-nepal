"use client";

/** SOS references + tracking tokens this device submitted (for guests). */
export type MySos = {
  ref: string;
  token: string;
  createdAt: string;
  /** Sent with this device's GPS: keep sharing its live position while open. */
  live?: boolean;
};

const KEY = "js:my-sos:v1";

export function readMySos(): MySos[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as MySos[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function rememberSos(entry: MySos) {
  try {
    const list = [entry, ...readMySos().filter((s) => s.ref !== entry.ref)].slice(0, 10);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable: the tracking link in the URL still works.
  }
}

export function tokenForRef(ref: string): string | null {
  return readMySos().find((s) => s.ref === ref)?.token ?? null;
}

/**
 * Adds the signed-in account's own SOS (sent from any device) to this
 * device's list, so it can be tracked here too. Existing entries are kept
 * as they are (only the sending device shares its live location).
 */
export async function syncAccountSos(): Promise<MySos[]> {
  try {
    const res = await fetch("/api/sos/mine", { cache: "no-store" });
    if (!res.ok) return readMySos();
    const { sos } = (await res.json()) as { sos?: MySos[] };
    const known = new Set(readMySos().map((s) => s.ref));
    const added = (sos ?? []).filter((s) => !known.has(s.ref)).map(({ ref, token, createdAt }) => ({ ref, token, createdAt }));
    if (added.length) {
      const list = [...readMySos(), ...added].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);
      localStorage.setItem(KEY, JSON.stringify(list));
    }
  } catch {
    // Offline or storage unavailable: use what this device already has.
  }
  return readMySos();
}

/** True only on the device that sent this SOS with its own GPS position. */
export function sharesLiveLocation(ref: string): boolean {
  return readMySos().find((s) => s.ref === ref)?.live === true;
}

const PHONE_KEY = "js:sos-phone";
export function readSavedPhone(): string {
  try {
    return localStorage.getItem(PHONE_KEY) ?? "";
  } catch {
    return "";
  }
}
export function savePhone(phone: string) {
  try {
    localStorage.setItem(PHONE_KEY, phone);
  } catch {
    // ignore
  }
}
