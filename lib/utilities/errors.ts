/**
 * Maps workflow function errors (raised with stable code prefixes in
 * supabase/migrations/..._workflows.sql) to safe, friendly messages.
 */
const MESSAGES: Record<string, string> = {
  FORBIDDEN: "You do not have permission to do that.",
  NOT_FOUND: "That record no longer exists. Refresh and try again.",
  INVALID_TRANSITION: "That status change is not allowed from the current state.",
  TEAM_UNAVAILABLE: "That rescue team is no longer available. Choose another team.",
  ALREADY_CLOSED: "This incident is already closed.",
  CONFLICT: "Another operator changed this incident a moment ago. The screen has been refreshed — check it and try again.",
};

export function friendlyWorkflowError(message: string | undefined | null): string {
  if (!message) return "Something went wrong. Please try again.";
  const code = message.split(":")[0]?.trim();
  if (code && MESSAGES[code]) {
    // Include the specific detail for availability/transition problems.
    const detail = message.slice(code.length + 1).trim();
    if ((code === "TEAM_UNAVAILABLE" || code === "INVALID_TRANSITION" || code === "ALREADY_CLOSED") && detail) {
      return `${MESSAGES[code]} (${detail})`;
    }
    return MESSAGES[code];
  }
  return "Something went wrong. Please try again.";
}
