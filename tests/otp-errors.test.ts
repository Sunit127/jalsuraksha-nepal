import { describe, expect, it } from "vitest";
import { DEMO_OTP_HINT, otpErrorMessage } from "@/lib/auth/otp-errors";

describe("otpErrorMessage", () => {
  it("explains a missing SMS provider and offers the labelled demo fallback", () => {
    const m = otpErrorMessage({ code: "sms_send_failed", status: 422, message: "Error sending confirmation OTP to provider" }, "send", true);
    expect(m).toContain("SMS provider");
    expect(m).toContain(DEMO_OTP_HINT);
  });

  it("does not mention demo accounts outside demo mode", () => {
    const m = otpErrorMessage({ code: "sms_send_failed", status: 422 }, "send", false);
    expect(m).not.toContain("Demo");
  });

  it("handles rate limits", () => {
    expect(otpErrorMessage({ code: "over_sms_send_rate_limit", status: 429 }, "send", true)).toMatch(/wait a minute/);
  });

  it("handles wrong or expired codes", () => {
    expect(otpErrorMessage({ code: "otp_expired", status: 403 }, "verify", true)).toMatch(/incorrect or has expired/);
  });

  it("treats a provider timeout as SMS unavailable", () => {
    const m = otpErrorMessage({ status: 504, message: "Processing this request timed out, please retry after a moment." }, "send", true);
    expect(m).toMatch(/SMS provider/);
    expect(m).toContain(DEMO_OTP_HINT);
  });

  it("handles network failures with an SOS pointer", () => {
    expect(otpErrorMessage({ status: 0, message: "Failed to fetch" }, "send", false)).toMatch(/EMERGENCY SOS/);
  });
});
