"use client";

/**
 * Lock-screen flood alerts via Web Push. The service worker (public/sw.js)
 * shows the notification; the server sends one per new alert.
 *
 * iPhone/iPad only allow web push for apps added to the Home Screen
 * (iOS 16.4+), so there the state is "needs-install" until then.
 */
export type PushState = "unsupported" | "needs-install" | "off" | "on" | "denied";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** The service worker is only registered in production builds. */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (process.env.NODE_ENV !== "production") return null;
  try {
    return (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
  } catch {
    return null;
  }
}

async function save(sub: PushSubscription): Promise<boolean> {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  }).catch(() => null);
  return Boolean(res?.ok);
}

export async function readPushState(): Promise<PushState> {
  if (typeof window === "undefined" || !VAPID_PUBLIC_KEY || !window.isSecureContext) return "unsupported";
  if (isIos() && !isStandalone()) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await registration();
  if (!reg) return "unsupported";
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/**
 * Asks for permission (call from a tap), subscribes and saves the
 * subscription on the server.
 */
export async function enablePushAlerts(): Promise<PushState> {
  const state = await readPushState();
  if (state === "unsupported" || state === "needs-install" || state === "denied") return state;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = await registration();
  if (!reg) return "unsupported";
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  return (await save(sub)) ? "on" : "off";
}

export async function disablePushAlerts(): Promise<PushState> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => null);
    await sub.unsubscribe().catch(() => false);
  }
  return "off";
}

/**
 * On each visit with permission granted, re-send the subscription (links a
 * new sign-in, and restores it if the server dropped it).
 */
export async function refreshPushSubscription(): Promise<void> {
  if ((await readPushState()) !== "on") return;
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await save(sub);
}
