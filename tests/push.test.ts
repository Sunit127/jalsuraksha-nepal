import { describe, expect, it } from "vitest";
import { alertPushPayload, pushConfigured, pushTtlSeconds, shouldPushAlert } from "@/lib/services/push";
import { pushSubscriptionSchema } from "@/lib/validation/schemas";

const NOW = Date.parse("2026-10-01T06:00:00Z");
const alert = {
  id: "a1",
  title: "Narayani above danger level",
  description: "Move to higher ground now.",
  severity: "danger" as const,
  source_type: "official" as const,
  is_active: true,
  expires_at: "2026-10-01T08:00:00Z",
};

describe("shouldPushAlert", () => {
  it("pushes active, unexpired official alerts", () => {
    expect(shouldPushAlert(alert, "live", NOW)).toBe(true);
  });
  it("never pushes simulated alerts in live mode, but does in simulation", () => {
    const sim = { ...alert, source_type: "simulated" as const };
    expect(shouldPushAlert(sim, "live", NOW)).toBe(false);
    expect(shouldPushAlert(sim, "simulation", NOW)).toBe(true);
  });
  it("skips withdrawn or expired alerts", () => {
    expect(shouldPushAlert({ ...alert, is_active: false }, "live", NOW)).toBe(false);
    expect(shouldPushAlert({ ...alert, expires_at: "2026-10-01T05:59:00Z" }, "live", NOW)).toBe(false);
  });
});

describe("alertPushPayload", () => {
  it("labels severity, shares the in-page notification tag and opens the alerts page", () => {
    expect(alertPushPayload(alert)).toEqual({
      title: "DANGER FLOOD ALERT — Narayani above danger level",
      body: "Move to higher ground now.",
      tag: "alert:a1",
      url: "/citizen/alerts",
      urgent: true,
    });
  });
  it("marks watch/info as not urgent and shortens long text", () => {
    const p = alertPushPayload({ ...alert, severity: "watch", description: "x".repeat(300) });
    expect(p.urgent).toBe(false);
    expect(p.body).toHaveLength(181);
  });
});

describe("pushTtlSeconds", () => {
  it("keeps retrying until the alert expires, capped at 24 h and at least a minute", () => {
    expect(pushTtlSeconds(alert, NOW)).toBe(7200);
    expect(pushTtlSeconds({ expires_at: null }, NOW)).toBe(86_400);
    expect(pushTtlSeconds({ expires_at: "2026-10-05T00:00:00Z" }, NOW)).toBe(86_400);
    expect(pushTtlSeconds({ expires_at: "2026-10-01T06:00:10Z" }, NOW)).toBe(60);
  });
});

describe("push configuration and input", () => {
  it("needs both VAPID keys", () => {
    expect(pushConfigured({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: "pub" })).toBe(false);
    expect(pushConfigured({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv" })).toBe(true);
  });
  it("accepts only https push endpoints with keys", () => {
    const keys = { p256dh: "BNc", auth: "tBH" };
    expect(pushSubscriptionSchema.safeParse({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys }).success).toBe(true);
    expect(pushSubscriptionSchema.safeParse({ endpoint: "http://evil.example/x", keys }).success).toBe(false);
    expect(pushSubscriptionSchema.safeParse({ endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "" , auth: "a" } }).success).toBe(false);
  });
});
