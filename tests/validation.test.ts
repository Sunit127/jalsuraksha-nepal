import { describe, expect, it } from "vitest";
import {
  detectImageType,
  hazardReportSchema,
  isInNepal,
  normalizeNepalPhone,
  profileSchema,
  sosFormSchema,
  sosTrackQuerySchema,
} from "@/lib/validation/schemas";

const validSos = {
  phone: "9800000001",
  latitude: 27.6935,
  longitude: 84.415,
  peopleCount: 5,
  childrenCount: 2,
  elderlyCount: 1,
  injured: true,
  situation: "water_rising",
};

describe("normalizeNepalPhone", () => {
  it.each([
    ["9841234567", "+9779841234567"],
    ["+977 984-1234567", "+9779841234567"],
    ["977 9761234567", "+9779761234567"],
    ["9651234567", "+9779651234567"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeNepalPhone(input)).toBe(expected);
  });

  it.each(["", "12345", "0141234567", "98412345678", "+1 415 555 0100", "abc"])("rejects %s", (input) => {
    expect(normalizeNepalPhone(input)).toBeNull();
  });
});

describe("sosFormSchema", () => {
  it("accepts the demo scenario and normalises the phone", () => {
    const r = sosFormSchema.safeParse(validSos);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBe("+9779800000001");
  });

  it("rejects children + elderly exceeding the group size", () => {
    const r = sosFormSchema.safeParse({ ...validSos, peopleCount: 2, childrenCount: 2, elderlyCount: 1 });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown situation", () => {
    expect(sosFormSchema.safeParse({ ...validSos, situation: "alien_invasion" }).success).toBe(false);
  });

  it("rejects invalid coordinates", () => {
    expect(sosFormSchema.safeParse({ ...validSos, latitude: 120 }).success).toBe(false);
    expect(sosFormSchema.safeParse({ ...validSos, longitude: Number.NaN }).success).toBe(false);
  });

  it("requires at least one person and caps description length", () => {
    expect(sosFormSchema.safeParse({ ...validSos, peopleCount: 0, childrenCount: 0, elderlyCount: 0 }).success).toBe(false);
    expect(sosFormSchema.safeParse({ ...validSos, description: "x".repeat(1001) }).success).toBe(false);
  });

  it("only accepts server-generated photo paths", () => {
    expect(sosFormSchema.safeParse({ ...validSos, photoPath: "sos/1b2c3d4e-0000-4000-8000-000000000000.jpg" }).success).toBe(true);
    expect(sosFormSchema.safeParse({ ...validSos, photoPath: "../../etc/passwd" }).success).toBe(false);
    expect(sosFormSchema.safeParse({ ...validSos, photoPath: "hazard/x.jpg" }).success).toBe(false);
  });

  it("drops unknown fields such as a client-supplied role or priority", () => {
    const r = sosFormSchema.safeParse({ ...validSos, role: "admin", priority_level: "critical", status: "resolved" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).not.toHaveProperty("role");
      expect(r.data).not.toHaveProperty("priority_level");
      expect(r.data).not.toHaveProperty("status");
    }
  });
});

describe("other schemas", () => {
  it("validates tracking queries", () => {
    expect(sosTrackQuerySchema.safeParse({ ref: "SOS-NEP-1001", token: "1ec82252-a688-4d2d-9068-cd08edfbfb31" }).success).toBe(true);
    expect(sosTrackQuerySchema.safeParse({ ref: "SOS-NEP-1001'; drop table", token: "x" }).success).toBe(false);
  });

  it("validates hazard reports", () => {
    expect(hazardReportSchema.safeParse({ type: "blocked_bridge", severity: "critical", latitude: 27.69, longitude: 84.42 }).success).toBe(true);
    expect(hazardReportSchema.safeParse({ type: "volcano", severity: "high", latitude: 27.69, longitude: 84.42 }).success).toBe(false);
    expect(hazardReportSchema.safeParse({ type: "other", severity: "low", latitude: 27.69, longitude: 84.42, photoUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(hazardReportSchema.safeParse({ type: "other", severity: "low", latitude: 27.69, longitude: 84.42, photoUrl: "https://example.com/x.jpg" }).success).toBe(false);
    expect(
      hazardReportSchema.safeParse({
        type: "other",
        severity: "low",
        latitude: 27.69,
        longitude: 84.42,
        photoUrl: "https://demo-project.supabase.co/storage/v1/object/public/hazard-photos/hazard/a.jpg",
      }).success,
    ).toBe(true);
  });

  it("validates profiles", () => {
    expect(profileSchema.safeParse({ fullName: "Sita Shrestha", emergencyContact: "9800000002" }).success).toBe(true);
    expect(profileSchema.safeParse({ fullName: "S" }).success).toBe(false);
    expect(profileSchema.safeParse({ fullName: "Sita", emergencyContact: "12345" }).success).toBe(false);
  });

  it("knows roughly where Nepal is", () => {
    expect(isInNepal(27.6935, 84.415)).toBe(true);
    expect(isInNepal(51.5, -0.12)).toBe(false);
  });
});

describe("detectImageType (upload magic bytes)", () => {
  it("recognises JPEG, PNG and WebP", () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(detectImageType(webp)).toBe("image/webp");
  });

  it("rejects everything else, even with an image extension", () => {
    expect(detectImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(detectImageType(new Uint8Array([]))).toBeNull();
  });
});
