"use client";

/** SOS references + tracking tokens this device submitted (for guests). */
export type MySos = { ref: string; token: string; createdAt: string };

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
