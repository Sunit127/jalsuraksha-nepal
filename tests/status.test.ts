import { describe, expect, it } from "vitest";
import {
  ASSIGNMENT_TO_SOS_STATUS,
  ASSIGNMENT_TRANSITIONS,
  canTransitionAssignment,
  canTransitionSos,
  RESCUE_NEXT_ACTION,
  SOS_TRANSITIONS,
  timelineProgress,
} from "@/lib/utilities/status";

describe("SOS transitions", () => {
  it("allows the normal rescue lifecycle", () => {
    const path = [
      "received",
      "acknowledged",
      "assigned",
      "accepted",
      "en_route",
      "arrived",
      "in_progress",
      "resolved",
    ] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransitionSos(path[i], path[i + 1])).toBe(true);
    }
  });

  it("does not reopen closed incidents", () => {
    expect(SOS_TRANSITIONS.resolved).toEqual([]);
    expect(SOS_TRANSITIONS.cancelled).toEqual([]);
    expect(canTransitionSos("resolved", "received")).toBe(false);
    expect(canTransitionSos("cancelled", "assigned")).toBe(false);
  });

  it("does not skip dispatch straight to arrival", () => {
    expect(canTransitionSos("received", "arrived")).toBe(false);
    expect(canTransitionSos("assigned", "arrived")).toBe(false);
  });

  it("lets operators resolve or citizens cancel from any open state", () => {
    for (const from of Object.keys(SOS_TRANSITIONS) as (keyof typeof SOS_TRANSITIONS)[]) {
      if (from === "resolved" || from === "cancelled") continue;
      expect(canTransitionSos(from, "resolved")).toBe(true);
      expect(canTransitionSos(from, "cancelled")).toBe(true);
    }
  });
});

describe("assignment transitions", () => {
  it("follows Accept → En Route → Arrived → In Progress → Completed", () => {
    let status: keyof typeof ASSIGNMENT_TRANSITIONS = "assigned";
    const seen: string[] = [];
    while (RESCUE_NEXT_ACTION[status]) {
      const next: { to: keyof typeof ASSIGNMENT_TRANSITIONS; label: string } =
        RESCUE_NEXT_ACTION[status]!;
      expect(canTransitionAssignment(status, next.to)).toBe(true);
      seen.push(next.label);
      status = next.to;
    }
    expect(seen).toEqual(["Accept Mission", "En Route", "Arrived", "Rescue In Progress", "Completed"]);
    expect(status).toBe("completed");
  });

  it("rejects going backwards or leaving terminal states", () => {
    expect(canTransitionAssignment("en_route", "accepted")).toBe(false);
    expect(canTransitionAssignment("completed", "en_route")).toBe(false);
    expect(canTransitionAssignment("cancelled", "assigned")).toBe(false);
  });

  it("maps every assignment status onto an SOS status the SOS machine accepts", () => {
    // Walking the assignment lifecycle must always be a valid SOS walk.
    const walk = ["assigned", "accepted", "en_route", "arrived", "in_progress", "completed"] as const;
    let sos: keyof typeof SOS_TRANSITIONS = "acknowledged";
    for (const a of walk) {
      const next = ASSIGNMENT_TO_SOS_STATUS[a];
      expect(canTransitionSos(sos, next)).toBe(true);
      sos = next;
    }
    // Cancelling an active assignment returns the SOS to the queue.
    for (const from of ["assigned", "accepted", "en_route", "arrived", "in_progress"] as const) {
      expect(canTransitionSos(ASSIGNMENT_TO_SOS_STATUS[from], ASSIGNMENT_TO_SOS_STATUS.cancelled)).toBe(true);
    }
  });
});

describe("citizen timeline", () => {
  it("counts reached steps", () => {
    expect(timelineProgress("received")).toBe(1);
    expect(timelineProgress("acknowledged")).toBe(2);
    expect(timelineProgress("en_route")).toBe(4);
    expect(timelineProgress("resolved")).toBe(6);
    expect(timelineProgress("cancelled")).toBe(0);
  });
});
