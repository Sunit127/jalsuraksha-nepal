import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSosRequest } from "@/lib/services/sos-intake";
import { SMS_HELP, parseSosSms } from "@/lib/services/sms";
import { latitudeSchema, longitudeSchema, nepalPhoneSchema, sosFormSchema } from "@/lib/validation/schemas";

/**
 * FUTURE SMS FALLBACK — architecture-ready endpoint, no gateway connected.
 * Disabled unless SMS_GATEWAY_SECRET is set. A real gateway would POST each
 * inbound message with the sender number and (if available) a network-based
 * location estimate.
 */
const bodySchema = z.object({
  from: nepalPhoneSchema,
  text: z.string().min(1).max(480),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
});

function authorized(request: NextRequest): boolean {
  const secret = process.env.SMS_GATEWAY_SECRET;
  const given = request.headers.get("x-sms-gateway-secret");
  if (!secret || !given) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!process.env.SMS_GATEWAY_SECRET) {
    return NextResponse.json({ error: "SMS fallback is not enabled." }, { status: 404 });
  }
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid payload.", reply: SMS_HELP }, { status: 400 });

  const parsed = parseSosSms(body.data.text);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, reply: SMS_HELP }, { status: 422 });

  if (body.data.latitude === undefined || body.data.longitude === undefined) {
    // An SOS needs coordinates (priority, map, dispatch distance), so nothing
    // is recorded. Say so plainly — never imply someone will call back.
    return NextResponse.json(
      {
        error: "Location unavailable",
        reply: "JalSuraksha: your SOS could NOT be registered because your location is unavailable. Call 100 (Police) or 102 (Ambulance) now.",
      },
      { status: 422 },
    );
  }

  const payload = sosFormSchema.safeParse({
    phone: body.data.from,
    latitude: body.data.latitude,
    longitude: body.data.longitude,
    peopleCount: parsed.peopleCount,
    childrenCount: parsed.childrenCount,
    elderlyCount: parsed.elderlyCount,
    injured: parsed.injured,
    situation: parsed.situation,
    description: parsed.description,
  });
  if (!payload.success) return NextResponse.json({ error: "Invalid SOS.", reply: SMS_HELP }, { status: 422 });

  const result = await createSosRequest(payload.data, { userId: null, source: "sms" });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({
    reference: result.reference,
    reply: `JalSuraksha: ${result.reference} received${result.duplicate ? " (already active)" : ""}. Stay safe, move higher if water rises. In danger call 100.`,
  });
}
