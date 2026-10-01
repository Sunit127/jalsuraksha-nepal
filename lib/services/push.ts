import "server-only";

import webpush, { WebPushError } from "web-push";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Alert } from "@/types/domain";

/** What the service worker receives (keep in sync with public/sw.js). */
export type AlertPushPayload = {
  title: string;
  body: string;
  tag: string;
  url: string;
  urgent: boolean;
};

const MAX_TTL_S = 24 * 3600;
const BATCH = 25;

export function pushConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

type PushableAlert = Pick<Alert, "id" | "title" | "description" | "severity" | "source_type" | "is_active" | "expires_at">;

/** Same visibility rule as the citizen app: no simulated alerts in live mode. */
export function shouldPushAlert(alert: PushableAlert, dataMode: "live" | "simulation", now = Date.now()): boolean {
  if (!alert.is_active) return false;
  if (alert.expires_at && new Date(alert.expires_at).getTime() <= now) return false;
  return dataMode === "simulation" || alert.source_type !== "simulated";
}

export function alertPushPayload(alert: PushableAlert): AlertPushPayload {
  const body = alert.description.length > 180 ? `${alert.description.slice(0, 180)}…` : alert.description;
  return {
    title: `${alert.severity.toUpperCase()} FLOOD ALERT — ${alert.title}`,
    body,
    // Same tag as the in-page notification, so the two replace each other.
    tag: `alert:${alert.id}`,
    url: "/citizen/alerts",
    urgent: alert.severity === "danger" || alert.severity === "high",
  };
}

/** Seconds the push service keeps trying to deliver (until the alert expires, max 24 h). */
export function pushTtlSeconds(alert: Pick<Alert, "expires_at">, now = Date.now()): number {
  if (!alert.expires_at) return MAX_TTL_S;
  return Math.max(60, Math.min(MAX_TTL_S, Math.round((new Date(alert.expires_at).getTime() - now) / 1000)));
}

/**
 * Sends an alert to every subscribed device. Subscriptions the push service
 * reports as gone (404/410) are deleted. Never throws.
 */
export async function sendAlertPush(alert: PushableAlert): Promise<{ sent: number; removed: number; failed: number }> {
  const result = { sent: 0, removed: 0, failed: 0 };
  if (!pushConfigured()) return result;
  try {
    const admin = createSupabaseAdminClient();
    const { data: mode } = await admin.from("app_settings").select("value").eq("key", "data_mode").maybeSingle();
    if (!shouldPushAlert(alert, mode?.value === "simulation" ? "simulation" : "live")) return result;

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "https://jalsuraksha-nepal.vercel.app",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth");
    const payload = JSON.stringify(alertPushPayload(alert));
    const options = { TTL: pushTtlSeconds(alert), urgency: "high" as const, timeout: 10_000 };
    const gone: string[] = [];
    const delivered: string[] = [];

    const list = subs ?? [];
    for (let i = 0; i < list.length; i += BATCH) {
      await Promise.all(
        list.slice(i, i + BATCH).map(async (s) => {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, options);
            delivered.push(s.id);
          } catch (error) {
            if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) gone.push(s.id);
            else {
              result.failed += 1;
              console.error("[push] send failed", error instanceof WebPushError ? error.statusCode : error);
            }
          }
        }),
      );
    }
    if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
    if (delivered.length) {
      await admin.from("push_subscriptions").update({ last_sent_at: new Date().toISOString() }).in("id", delivered);
    }
    result.sent = delivered.length;
    result.removed = gone.length;
  } catch (error) {
    console.error("[push] alert push failed", error);
  }
  return result;
}
