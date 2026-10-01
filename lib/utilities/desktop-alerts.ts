"use client";

/**
 * Browser (system) notifications, so people hear about something urgent even
 * when the app's tab is in the background: new SOS for staff, new missions for
 * rescue teams, new flood alerts for citizens. Needs a secure context (https
 * or localhost) and the person's permission; always optional.
 */
export type DesktopPermission = NotificationPermission | "unsupported";

const listeners = new Set<() => void>();

export function desktopAlertsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window && window.isSecureContext;
}

export function readDesktopPermission(): DesktopPermission {
  return desktopAlertsSupported() ? Notification.permission : "unsupported";
}

/** For useSyncExternalStore; the permission can change from our own prompt. */
export function subscribeDesktopPermission(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const serverDesktopPermission = (): DesktopPermission => "unsupported";

export async function requestDesktopAlerts(): Promise<DesktopPermission> {
  if (!desktopAlertsSupported()) return "unsupported";
  const result = await Notification.requestPermission();
  listeners.forEach((l) => l());
  return result;
}

/**
 * Shows a system notification if allowed and the page is not being looked at
 * (when it is, the in-app toast is enough). Returns true if one was shown.
 */
export function showDesktopAlert(opts: {
  title: string;
  body?: string;
  /** Same tag = replaces instead of stacking (e.g. one per SOS). */
  tag: string;
  urgent?: boolean;
  onOpen?: () => void;
}): boolean {
  if (readDesktopPermission() !== "granted" || document.visibilityState === "visible") return false;
  try {
    const n = new Notification(opts.title, { body: opts.body, tag: opts.tag, requireInteraction: Boolean(opts.urgent) });
    n.onclick = () => {
      window.focus();
      opts.onOpen?.();
      n.close();
    };
    return true;
  } catch {
    // Some browsers (e.g. Android Chrome) only allow notifications from a service worker.
    return false;
  }
}
