import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/utilities/rate-limit";
import { IMAGE_EXTENSION, MAX_UPLOAD_BYTES, detectImageType } from "@/lib/validation/schemas";

/**
 * Photo uploads for SOS (private bucket, guests allowed) and hazard reports
 * (public bucket, signed-in users). Files are validated by size and magic
 * bytes and stored under a random server-generated name.
 */
export async function POST(request: NextRequest) {
  const limit = rateLimit(`upload:${clientIp(request.headers)}`, 10, 10 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const kind = form.get("kind");
  const file = form.get("file");
  if ((kind !== "sos" && kind !== "hazard") || !(file instanceof File)) {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Photo must be smaller than 5 MB." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) {
    return NextResponse.json({ error: "Only JPEG, PNG or WebP photos are accepted." }, { status: 415 });
  }

  if (kind === "hazard") {
    const session = await getSessionContext();
    if (!session.userId || session.isAnonymous) {
      return NextResponse.json({ error: "Please sign in to attach photos to reports." }, { status: 401 });
    }
  }

  const path = `${kind}/${randomUUID()}.${IMAGE_EXTENSION[type]}`;
  const bucket = kind === "sos" ? "sos-photos" : "hazard-photos";

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.storage.from(bucket).upload(path, bytes, {
      contentType: type,
      upsert: false,
    });
    if (error) {
      console.error("[api/uploads] storage error", error.message);
      return NextResponse.json({ error: "Photo upload failed. You can send without a photo." }, { status: 502 });
    }
    if (kind === "hazard") {
      const { data } = admin.storage.from(bucket).getPublicUrl(path);
      return NextResponse.json({ path, url: data.publicUrl }, { status: 201 });
    }
    return NextResponse.json({ path }, { status: 201 });
  } catch (error) {
    console.error("[api/uploads] failed", error);
    return NextResponse.json({ error: "Photo upload failed. You can send without a photo." }, { status: 503 });
  }
}
