import { describe, expect, it } from "vitest";
import { canAccess, homeForRole, isStaffRole, safeRedirectPath } from "@/lib/auth/roles";

describe("canAccess", () => {
  it("keeps citizen screens (and SOS) public", () => {
    expect(canAccess(null, "citizen")).toBe(true);
    expect(canAccess(undefined, "citizen")).toBe(true);
  });

  it("restricts the operations centre to operators and admins", () => {
    expect(canAccess("operator", "dashboard")).toBe(true);
    expect(canAccess("admin", "dashboard")).toBe(true);
    expect(canAccess("citizen", "dashboard")).toBe(false);
    expect(canAccess("rescue", "dashboard")).toBe(false);
    expect(canAccess(null, "dashboard")).toBe(false);
  });

  it("restricts user management to admins", () => {
    expect(canAccess("admin", "admin")).toBe(true);
    expect(canAccess("operator", "admin")).toBe(false);
  });

  it("gives the rescue console to rescue teams and staff (who oversee all teams)", () => {
    expect(canAccess("rescue", "rescue")).toBe(true);
    expect(canAccess("admin", "rescue")).toBe(true);
    expect(canAccess("operator", "rescue")).toBe(true);
    expect(canAccess("citizen", "rescue")).toBe(false);
  });

  it("requires an account for citizen account features", () => {
    expect(canAccess(null, "citizen-account")).toBe(false);
    expect(canAccess("citizen", "citizen-account")).toBe(true);
  });

  it("treats unknown role strings as no access", () => {
    expect(canAccess("superuser" as never, "dashboard")).toBe(false);
  });
});

describe("role helpers", () => {
  it("identifies staff", () => {
    expect(isStaffRole("operator")).toBe(true);
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole("rescue")).toBe(false);
    expect(isStaffRole(null)).toBe(false);
  });

  it("sends each role to its workspace", () => {
    expect(homeForRole("operator")).toBe("/dashboard");
    expect(homeForRole("admin")).toBe("/dashboard");
    expect(homeForRole("rescue")).toBe("/rescue");
    expect(homeForRole("citizen")).toBe("/citizen");
    expect(homeForRole(null)).toBe("/citizen");
  });
});

describe("safeRedirectPath", () => {
  it("allows same-origin paths", () => {
    expect(safeRedirectPath("/dashboard/incidents/1", "/")).toBe("/dashboard/incidents/1");
  });
  it("blocks open redirects", () => {
    expect(safeRedirectPath("https://evil.example", "/citizen")).toBe("/citizen");
    expect(safeRedirectPath("//evil.example", "/citizen")).toBe("/citizen");
    expect(safeRedirectPath("/\\evil.example", "/citizen")).toBe("/citizen");
    expect(safeRedirectPath(null, "/citizen")).toBe("/citizen");
  });
});
