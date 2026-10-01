/**
 * Zod schemas shared by client forms and server handlers.
 * The server always re-validates; never trust client-side validation alone.
 */
import { z } from "zod";
import { SUPABASE_URL } from "@/lib/supabase/env";

// ---------------------------------------------------------------------------
// Nepal phone numbers
// ---------------------------------------------------------------------------

/**
 * Normalises a Nepal mobile number to E.164 (+977XXXXXXXXXX).
 * Accepts "98XXXXXXXX", "+977 98XXXXXXXX", "977-98XXXXXXXX", etc.
 * Returns null when it is not a valid Nepal mobile number (9[678]XXXXXXXX).
 */
export function normalizeNepalPhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  const local = digits.startsWith("977") && digits.length === 13 ? digits.slice(3) : digits;
  if (!/^9[678]\d{8}$/.test(local)) return null;
  return `+977${local}`;
}

export const nepalPhoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .transform((value, ctx) => {
    const normalized = normalizeNepalPhone(value);
    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a Nepal mobile number, e.g. 98XXXXXXXX",
      });
      return z.NEVER;
    }
    return normalized;
  });

export const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code");

export const staffLoginSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
});

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------
export const latitudeSchema = z.number().finite().min(-90).max(90);
export const longitudeSchema = z.number().finite().min(-180).max(180);

/** Rough bounding box of Nepal (with margin) — rejects obviously wrong GPS. */
export const NEPAL_BOUNDS = { minLat: 26.2, maxLat: 30.6, minLng: 79.9, maxLng: 88.3 };
export function isInNepal(lat: number, lng: number) {
  return (
    lat >= NEPAL_BOUNDS.minLat &&
    lat <= NEPAL_BOUNDS.maxLat &&
    lng >= NEPAL_BOUNDS.minLng &&
    lng <= NEPAL_BOUNDS.maxLng
  );
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const uuidSchema = z.uuid();

// ---------------------------------------------------------------------------
// SOS
// ---------------------------------------------------------------------------
export const SOS_SITUATIONS = [
  "safe_temporarily",
  "water_entering",
  "water_rising",
  "trapped",
  "medical",
  "other",
] as const;

const sosDetailsObject = z.object({
  phone: nepalPhoneSchema,
  peopleCount: z.number().int().min(1, "At least 1 person").max(200),
  childrenCount: z.number().int().min(0).max(200),
  elderlyCount: z.number().int().min(0).max(200),
  injured: z.boolean("Tell us if anyone is injured"),
  situation: z.enum(SOS_SITUATIONS, "Choose your situation"),
  description: optionalText(1000),
});

const countsAddUp = (v: { peopleCount: number; childrenCount: number; elderlyCount: number }) =>
  v.childrenCount + v.elderlyCount <= v.peopleCount;
const countsMessage = {
  message: "Children + elderly cannot be more than the total number of people",
  path: ["peopleCount"],
};

/** What the person fills in (location is captured separately). */
export const sosDetailsSchema = sosDetailsObject.refine(countsAddUp, countsMessage);
export type SosDetailsInput = z.input<typeof sosDetailsSchema>;
export type SosDetailsValues = z.output<typeof sosDetailsSchema>;

/** Full SOS payload accepted by POST /api/sos. */
export const sosFormSchema = sosDetailsObject
  .extend({
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    locationAccuracyM: z.number().int().min(0).max(100_000).optional(),
    locationName: optionalText(120),
    photoPath: z
      .string()
      .regex(/^sos\/[0-9a-f-]{36}\.(jpg|png|webp)$/, "Invalid photo reference")
      .optional(),
  })
  .refine(countsAddUp, countsMessage);

export type SosFormInput = z.input<typeof sosFormSchema>;
export type SosFormValues = z.output<typeof sosFormSchema>;

export const sosTrackQuerySchema = z.object({
  ref: z.string().regex(/^SOS-NEP-\d{4,}$/, "Invalid reference"),
  token: uuidSchema,
});

/** A browser PushSubscription (toJSON()) for lock-screen alerts. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

/** Live position update from the caller's phone while the SOS is open. */
export const sosLocationUpdateSchema = sosTrackQuerySchema.extend({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  accuracyM: z.number().finite().min(0).optional(),
});

// ---------------------------------------------------------------------------
// Hazard reports
// ---------------------------------------------------------------------------
export const HAZARD_TYPES = [
  "flooded_road",
  "landslide",
  "blocked_bridge",
  "waterlogging",
  "damaged_infrastructure",
  "stranded_people",
  "other",
] as const;

export const HAZARD_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export const hazardReportSchema = z.object({
  type: z.enum(HAZARD_TYPES, "Choose a hazard type"),
  severity: z.enum(HAZARD_SEVERITIES, "Choose a severity"),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  locationName: optionalText(120),
  description: optionalText(1000),
  photoUrl: z
    .url({ protocol: /^https?$/ })
    .refine((u) => !SUPABASE_URL || u.startsWith(`${SUPABASE_URL}/storage/v1/object/public/hazard-photos/`), {
      message: "Photo must be uploaded through JalSuraksha",
    })
    .optional(),
});
export type HazardReportInput = z.input<typeof hazardReportSchema>;

// ---------------------------------------------------------------------------
// Profile & family safety
// ---------------------------------------------------------------------------
export const SAFETY_STATUSES = ["unknown", "safe", "evacuated", "need_help"] as const;

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name").max(80),
  district: optionalText(60),
  municipality: optionalText(80),
  ward: z
    .number()
    .int()
    .min(1)
    .max(40)
    .optional(),
  emergencyContact: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const n = normalizeNepalPhone(v);
      if (!n) {
        ctx.addIssue({ code: "custom", message: "Enter a Nepal mobile number" });
        return z.NEVER;
      }
      return n;
    }),
});
export type ProfileInput = z.input<typeof profileSchema>;

export const safetyStatusSchema = z.enum(SAFETY_STATUSES);

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------
export const PRIORITY_LEVELS = ["low", "moderate", "high", "critical"] as const;

export const priorityOverrideSchema = z.object({
  sosId: uuidSchema,
  level: z.enum(PRIORITY_LEVELS).nullable(),
  note: optionalText(300),
});

export const assignTeamSchema = z.object({
  sosId: uuidSchema,
  teamId: uuidSchema,
  /** Team the operator's screen showed as assigned (null = none): concurrency guard. */
  expectedTeamId: uuidSchema.nullable().default(null),
  note: optionalText(300),
});

export const ASSIGNMENT_STATUSES = [
  "assigned",
  "accepted",
  "en_route",
  "arrived",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export const assignmentStatusSchema = z.object({
  assignmentId: uuidSchema,
  status: z.enum(ASSIGNMENT_STATUSES),
  note: optionalText(300),
});

export const shelterOccupancySchema = z.object({
  shelterId: uuidSchema,
  currentOccupancy: z.number().int().min(0).max(100_000),
  foodStatus: z.enum(["available", "limited", "unavailable"]).optional(),
  waterStatus: z.enum(["available", "limited", "unavailable"]).optional(),
  medicalAssistance: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const ALERT_SEVERITIES = ["info", "watch", "high", "danger"] as const;

export const alertSchema = z.object({
  title: z.string().trim().min(3, "Title is too short").max(160),
  description: z.string().trim().min(3, "Add a description").max(2000),
  severity: z.enum(ALERT_SEVERITIES),
  district: optionalText(60),
  municipality: optionalText(80),
  riverBasin: optionalText(60),
  source: z.string().trim().min(2).max(120),
  sourceType: z.enum(["official", "community", "simulated"]),
  expiresInHours: z.number().int().min(1).max(168),
});
export type AlertInput = z.input<typeof alertSchema>;

export const APP_ROLES = ["citizen", "operator", "rescue", "admin"] as const;

export const roleUpdateSchema = z.object({
  userId: uuidSchema,
  role: z.enum(APP_ROLES),
  rescueTeamId: uuidSchema.nullable(),
});

export const hazardReviewSchema = z.object({
  reportId: uuidSchema,
  status: z.enum(["open", "verified", "resolved", "rejected"]),
});

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/** Validate by magic bytes, not just the declared content type. */
export function detectImageType(bytes: Uint8Array): AllowedImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export const IMAGE_EXTENSION: Record<AllowedImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** First Zod issue message, for friendly single-line errors. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
