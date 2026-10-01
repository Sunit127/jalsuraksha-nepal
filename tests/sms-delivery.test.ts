import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  loginCodeMessage,
  sendViaTwilio,
  smsDeliveryMode,
  toE164,
  verifyHookSignature,
} from "@/lib/services/sms-delivery";

const KEY = Buffer.from("test-signing-key-32-bytes-long!!").toString("base64");
const SECRET = `v1,whsec_${KEY}`;

function sign(id: string, ts: number, body: string, key = KEY) {
  return `v1,${createHmac("sha256", Buffer.from(key, "base64")).update(`${id}.${ts}.${body}`).digest("base64")}`;
}

describe("verifyHookSignature", () => {
  const body = JSON.stringify({ user: { phone: "9779800000001" }, sms: { otp: "123456" } });
  const now = 1_790_000_000;

  it("accepts a valid Standard Webhooks signature", () => {
    expect(verifyHookSignature(SECRET, { id: "msg_1", timestamp: String(now), signature: sign("msg_1", now, body) }, body, now)).toBe(true);
  });

  it("rejects a tampered body, wrong key, stale timestamp or missing headers", () => {
    const sig = sign("msg_1", now, body);
    expect(verifyHookSignature(SECRET, { id: "msg_1", timestamp: String(now), signature: sig }, body.replace("123456", "000000"), now)).toBe(false);
    const other = Buffer.from("another-key-another-key-another!!").toString("base64");
    expect(verifyHookSignature(SECRET, { id: "msg_1", timestamp: String(now), signature: sign("msg_1", now, body, other) }, body, now)).toBe(false);
    expect(verifyHookSignature(SECRET, { id: "msg_1", timestamp: String(now), signature: sig }, body, now + 3600)).toBe(false);
    expect(verifyHookSignature(SECRET, { id: null, timestamp: String(now), signature: sig }, body, now)).toBe(false);
    expect(verifyHookSignature("", { id: "msg_1", timestamp: String(now), signature: sig }, body, now)).toBe(false);
  });

  it("accepts any matching signature in a multi-signature header", () => {
    const header = `v1,AAAA ${sign("msg_2", now, body)}`;
    expect(verifyHookSignature(SECRET, { id: "msg_2", timestamp: String(now), signature: header }, body, now)).toBe(true);
  });
});

describe("smsDeliveryMode", () => {
  const twilio = { TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_MESSAGING_SERVICE_SID: "MG1" };

  it("uses Twilio whenever it is fully configured", () => {
    expect(smsDeliveryMode({ NODE_ENV: "production", ...twilio })).toBe("twilio");
    expect(smsDeliveryMode({ NODE_ENV: "development", TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_FROM_NUMBER: "+15550001111" })).toBe("twilio");
  });

  it("only logs codes outside production", () => {
    expect(smsDeliveryMode({ NODE_ENV: "development" })).toBe("dev-log");
    expect(smsDeliveryMode({ NODE_ENV: "production" })).toBe("none");
    expect(smsDeliveryMode({ NODE_ENV: "production", TWILIO_ACCOUNT_SID: "AC1" })).toBe("none");
  });
});

describe("sendViaTwilio", () => {
  const env = { TWILIO_ACCOUNT_SID: "AC123", TWILIO_AUTH_TOKEN: "tok", TWILIO_MESSAGING_SERVICE_SID: "MG9" };

  it("posts the message to Twilio with basic auth", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 201 }));
    const res = await sendViaTwilio(env, "+9779800000001", loginCodeMessage("123456"), fetchImpl as unknown as typeof fetch);
    expect(res).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("AC123:tok").toString("base64")}`);
    const form = new URLSearchParams(init.body as string);
    expect(form.get("To")).toBe("+9779800000001");
    expect(form.get("MessagingServiceSid")).toBe("MG9");
    expect(form.get("Body")).toContain("123456");
  });

  it("reports Twilio errors and network failures", async () => {
    const rejected = vi.fn(async () => new Response(JSON.stringify({ code: 21408, message: "Permission to send an SMS has not been enabled" }), { status: 400 }));
    const r1 = await sendViaTwilio(env, "+9779800000001", "x", rejected as unknown as typeof fetch);
    expect(r1).toEqual({ ok: false, error: expect.stringContaining("21408") });
    const down = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    const r2 = await sendViaTwilio(env, "+9779800000001", "x", down as unknown as typeof fetch);
    expect(r2).toEqual({ ok: false, error: expect.stringContaining("unreachable") });
  });
});

describe("toE164", () => {
  it("adds the plus sign Supabase leaves off", () => {
    expect(toE164("9779800000001")).toBe("+9779800000001");
    expect(toE164("+977 980-0000001")).toBe("+9779800000001");
  });
});
