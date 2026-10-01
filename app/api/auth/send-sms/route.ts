import { NextResponse, type NextRequest } from "next/server";
import {
  loginCodeMessage,
  sendViaTwilio,
  smsDeliveryMode,
  toE164,
  verifyHookSignature,
} from "@/lib/services/sms-delivery";

/**
 * Supabase Auth "Send SMS" hook. Supabase generates the login code and calls
 * this endpoint to deliver it (configured in supabase/config.toml locally,
 * Authentication → Hooks on hosted projects). Requests must carry a valid
 * Standard Webhooks signature made with SEND_SMS_HOOK_SECRET.
 */
type HookPayload = {
  user?: { phone?: string | null };
  sms?: { otp?: string | null; phone?: string | null };
};

function hookError(status: number, message: string) {
  // Supabase Auth only relays a hook's error when the response is HTTP 200
  // with an `error` object; `http_code` and `message` then reach the client.
  // Any other response status becomes a generic "unexpected status" 500.
  return NextResponse.json({ error: { http_code: status, message } }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const secret = process.env.SEND_SMS_HOOK_SECRET ?? "";
  const body = await request.text();
  const signed = verifyHookSignature(
    secret,
    {
      id: request.headers.get("webhook-id"),
      timestamp: request.headers.get("webhook-timestamp"),
      signature: request.headers.get("webhook-signature"),
    },
    body,
  );
  if (!signed) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let payload: HookPayload;
  try {
    payload = JSON.parse(body) as HookPayload;
  } catch {
    return hookError(400, "Invalid hook payload.");
  }
  const phone = payload.sms?.phone ?? payload.user?.phone;
  const code = payload.sms?.otp;
  if (!phone || !code) return hookError(400, "Invalid hook payload.");

  const to = toE164(phone);
  const mode = smsDeliveryMode(process.env);

  if (mode === "twilio") {
    const sent = await sendViaTwilio(process.env, to, loginCodeMessage(code));
    if (sent.ok) return NextResponse.json({});
    console.error("[sms] delivery failed", sent.error);
    return hookError(502, "Error sending SMS: the SMS provider rejected the message.");
  }

  if (mode === "dev-log") {
    console.info(`\n[dev-sms] Login code for ${to}: ${code}  (development only — no SMS was sent)\n`);
    return NextResponse.json({});
  }

  return hookError(503, "Error sending SMS: no SMS provider is configured.");
}
