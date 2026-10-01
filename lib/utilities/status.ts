/**
 * Incident and assignment state machines.
 * Mirrors public.sos_transition_allowed / public.assignment_transition_allowed
 * in supabase/migrations/20260930000003_workflows.sql — keep them in sync.
 */
import type { AssignmentStatus, SosStatus } from "@/types/domain";

export const SOS_TRANSITIONS: Record<SosStatus, readonly SosStatus[]> = {
  received: ["acknowledged", "assigned", "resolved", "cancelled"],
  acknowledged: ["assigned", "resolved", "cancelled"],
  assigned: ["accepted", "assigned", "acknowledged", "resolved", "cancelled"],
  accepted: ["en_route", "assigned", "acknowledged", "resolved", "cancelled"],
  en_route: ["arrived", "acknowledged", "resolved", "cancelled"],
  arrived: ["in_progress", "acknowledged", "resolved", "cancelled"],
  in_progress: ["acknowledged", "resolved", "cancelled"],
  resolved: [],
  cancelled: [],
};

export const ASSIGNMENT_TRANSITIONS: Record<AssignmentStatus, readonly AssignmentStatus[]> = {
  assigned: ["accepted", "cancelled"],
  accepted: ["en_route", "cancelled"],
  en_route: ["arrived", "cancelled"],
  arrived: ["in_progress", "completed", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransitionSos(from: SosStatus, to: SosStatus): boolean {
  return SOS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionAssignment(from: AssignmentStatus, to: AssignmentStatus): boolean {
  return ASSIGNMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export const CLOSED_SOS_STATUSES: readonly SosStatus[] = ["resolved", "cancelled"];

export function isSosOpen(status: SosStatus): boolean {
  return !CLOSED_SOS_STATUSES.includes(status);
}

export function isAssignmentActive(status: AssignmentStatus): boolean {
  return status !== "completed" && status !== "cancelled";
}

/** Maps an assignment status to the SOS status it produces. */
export const ASSIGNMENT_TO_SOS_STATUS: Record<AssignmentStatus, SosStatus> = {
  assigned: "assigned",
  accepted: "accepted",
  en_route: "en_route",
  arrived: "arrived",
  in_progress: "in_progress",
  completed: "resolved",
  cancelled: "acknowledged",
};

/** The primary next action a rescue team takes from each assignment status. */
export const RESCUE_NEXT_ACTION: Partial<
  Record<AssignmentStatus, { to: AssignmentStatus; label: string }>
> = {
  assigned: { to: "accepted", label: "Accept Mission" },
  accepted: { to: "en_route", label: "En Route" },
  en_route: { to: "arrived", label: "Arrived" },
  arrived: { to: "in_progress", label: "Rescue In Progress" },
  in_progress: { to: "completed", label: "Completed" },
};

export const SOS_STATUS_LABEL: Record<SosStatus, string> = {
  received: "Received",
  acknowledged: "Acknowledged",
  assigned: "Team assigned",
  accepted: "Team preparing",
  en_route: "Team dispatched",
  arrived: "Team arrived",
  in_progress: "Rescue in progress",
  resolved: "Completed",
  cancelled: "Closed — reported safe",
};

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  assigned: "Assigned",
  accepted: "Preparing",
  en_route: "Dispatched",
  arrived: "Arriving / on scene",
  in_progress: "Rescue in progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Citizen-facing timeline steps and which SOS statuses mark each as reached. */
export const CITIZEN_TIMELINE: { key: string; label: string; reachedBy: readonly SosStatus[] }[] = [
  {
    key: "received",
    label: "Request received",
    reachedBy: ["received", "acknowledged", "assigned", "accepted", "en_route", "arrived", "in_progress", "resolved"],
  },
  {
    key: "notified",
    label: "Control centre notified",
    reachedBy: ["acknowledged", "assigned", "accepted", "en_route", "arrived", "in_progress", "resolved"],
  },
  {
    key: "assigned",
    label: "Rescue team assigned",
    reachedBy: ["assigned", "accepted", "en_route", "arrived", "in_progress", "resolved"],
  },
  { key: "dispatched", label: "Team dispatched", reachedBy: ["en_route", "arrived", "in_progress", "resolved"] },
  { key: "arrived", label: "Team arrived", reachedBy: ["arrived", "in_progress", "resolved"] },
  { key: "completed", label: "Completed", reachedBy: ["resolved"] },
];

export function timelineProgress(status: SosStatus): number {
  return CITIZEN_TIMELINE.filter((s) => s.reachedBy.includes(status)).length;
}
