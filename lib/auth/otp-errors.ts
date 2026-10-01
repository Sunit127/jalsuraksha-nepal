/**
 * Maps Supabase Auth phone-OTP failures to clear, honest messages.
 * In demo mode we point to the clearly labelled demo fallbacks instead of
 * pretending SMS delivery works.
 */
export type OtpStage = "send" | "verify";

type AuthLikeError = { code?: string | null; status?: number | null; message?: string | null };

export const DEMO_OTP_HINT =
  "Demo fallback: use test number 9800000001 with code 123456, or the “Citizen Demo” button below.";

export function otpErrorMessage(error: AuthLikeError, stage: OtpStage, demoMode: boolean): string {
  const code = error.code ?? "";
  const status = error.status ?? 0;
  const msg = (error.message ?? "").toLowerCase();
  const withDemo = (text: string) => (demoMode ? `${text} ${DEMO_OTP_HINT}` : text);

  if (code === "over_sms_send_rate_limit" || code === "over_request_rate_limit" || status === 429) {
    return "Too many codes requested. Please wait a minute before trying again.";
  }
  if (stage === "verify") {
    if (code === "otp_expired" || code === "otp_invalid" || status === 403) {
      return "That code is incorrect or has expired. Check the SMS or request a new code.";
    }
  }
  if (
    code === "sms_send_failed" ||
    code === "phone_provider_disabled" ||
    msg.includes("sms provider") ||
    msg.includes("unsupported phone provider") ||
    msg.includes("error sending") ||
    // Provider misconfigured/unreachable: Auth gives up after its deadline (504).
    (stage === "send" && (code === "request_timeout" || status === 504 || msg.includes("timed out")))
  ) {
    return withDemo("SMS could not be sent — the SMS provider is not configured or unavailable.");
  }
  if (code === "signup_disabled" || code === "phone_signup_disabled" || msg.includes("signups not allowed")) {
    return withDemo("New phone sign-ups are currently disabled.");
  }
  if (code === "validation_failed" || msg.includes("invalid phone")) {
    return "That phone number was not accepted. Use a Nepal mobile number such as 98XXXXXXXX.";
  }
  if (status === 0 || msg.includes("fetch") || msg.includes("network")) {
    return "No connection to the sign-in service. Check your internet connection. If you are in danger, use EMERGENCY SOS or call 100.";
  }
  return stage === "send"
    ? withDemo("Could not send the code. Please try again.")
    : "Could not verify the code. Please try again.";
}
