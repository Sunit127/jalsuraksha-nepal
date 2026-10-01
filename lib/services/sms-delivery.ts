import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Login-code delivery for Supabase's "Send SMS" auth hook.
 *
 * Supabase generates and verifies the one-time code; this module only decides
 * how it reaches the person:
 *   - twilio  — real SMS, when Twilio credentials are configured;
 *   - dev-log — development only: printed to the server log so any number can
 *               sign in locally without a paid provider (never in production,
 *               never shown in the app);
 *   - none    — nothing configured: the sign-in screen reports it honestly.
 */
export type SmsDeliveryMode = "twilio" | "dev-log" | "none";

export type SmsEnv = {
  NODE_ENV?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_MESSAGING_SERVICE_SID?: string;
  TWILIO_FROM_NUMBER?: string;
};

export function twilioConfigured(env: SmsEnv): boolean {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && (env.TWILIO_MESSAGING_SERVICE_SID || env.TWILIO_FROM_NUMBER));
}

export function smsDeliveryMode(env: SmsEnv): SmsDeliveryMode {
  if (twilioConfigured(env)) return "twilio";
  if (env.NODE_ENV !== "production") return "dev-log";
  return "none";
}

export function loginCodeMessage(code: string): string {
  return `JalSuraksha login code: ${code}. Do not share this code with anyone.`;
}

/** E.164 with a leading "+" (Supabase sends the phone without it). */
export function toE164(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `+${digits}`;
}

const WEBHOOK_TOLERANCE_S = 5 * 60;

/**
 * Standard Webhooks verification (what Supabase auth hooks use). `secret` is
 * the hook secret as configured, e.g. "v1,whsec_<base64>".
 */
export function verifyHookSignature(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  nowS = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!secret || !id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowS - ts) > WEBHOOK_TOLERANCE_S) return false;

  const base64Key = secret.replace(/^v1,/, "").replace(/^whsec_/, "");
  let key: Buffer;
  try {
    key = Buffer.from(base64Key, "base64");
  } catch {
    return false;
  }
  if (key.length === 0) return false;

  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  // The header may carry several space-separated "v1,<base64>" signatures.
  return signature.split(" ").some((part) => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export type SendResult = { ok: true } | { ok: false; error: string };

/** Sends one SMS through Twilio's Messages API. */
export async function sendViaTwilio(
  env: SmsEnv,
  to: string,
  text: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 4000,
): Promise<SendResult> {
  if (!twilioConfigured(env)) return { ok: false, error: "Twilio is not configured." };
  const form = new URLSearchParams({ To: to, Body: text });
  if (env.TWILIO_MESSAGING_SERVICE_SID) form.set("MessagingServiceSid", env.TWILIO_MESSAGING_SERVICE_SID);
  else form.set("From", env.TWILIO_FROM_NUMBER!);

  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
  try {
    const res = await fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.TWILIO_ACCOUNT_SID!)}/Messages.json`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (res.ok) return { ok: true };
    const detail = (await res.json().catch(() => null)) as { code?: number; message?: string } | null;
    return { ok: false, error: `Twilio ${res.status}${detail?.code ? ` (${detail.code})` : ""}: ${detail?.message ?? "request failed"}` };
  } catch (error) {
    return { ok: false, error: `Twilio unreachable: ${(error as Error).message}` };
  }
}
