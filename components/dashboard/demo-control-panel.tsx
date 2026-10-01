"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Circle, ExternalLink, FlaskConical, Loader2, RotateCcw, Waves } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DEMO_SOS_INPUT } from "@/lib/demo/scenario";
import { cn } from "@/lib/utils";
import { setDataMode } from "@/app/dashboard/actions";
import { useOpsData } from "./ops-data";
import { SystemCheck } from "./system-check";

const DEMO_PHONE = `+977${DEMO_SOS_INPUT.phone}`;

export function DemoControlPanel() {
  const { sos, hazards, assignments, teamById, dataMode } = useOpsData();
  const [busy, setBusy] = useState<string | null>(null);

  // Track the scenario from live data: the newest open-or-recent demo SOS.
  const demoSos = [...sos]
    .filter((s) => s.phone === DEMO_PHONE && s.source === "app")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  const assignment = demoSos
    ? assignments.filter((a) => a.sos_id === demoSos.id).sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime())[0]
    : undefined;
  const team = demoSos?.assigned_team_id ? teamById.get(demoSos.assigned_team_id) : undefined;
  const bridge = hazards.find((h) => h.type === "blocked_bridge" && h.location_name?.includes("Riverside Link"));
  const bridgeBlocked = Boolean(bridge && (bridge.status === "open" || bridge.status === "verified"));
  const at = (s: string) => Boolean(assignment && ["accepted", "en_route", "arrived", "in_progress", "completed"].indexOf(assignment.status) >= ["accepted", "en_route", "arrived", "in_progress", "completed"].indexOf(s));

  const steps: { n: number; who: string; title: string; how: string; done?: boolean; link?: { href: string; label: string } }[] = [
    { n: 1, who: "Citizen", title: "Open the app — flood DANGER scenario", how: "Home shows DANGER 84 for Narayani Riverside with the DANGER alert.", link: { href: "/citizen", label: "Open citizen app" } },
    { n: 2, who: "Citizen", title: "Open the live map", how: "Map tab: risk areas, hazards, shelters, hospitals, legend.", link: { href: "/citizen/map", label: "Open map" } },
    { n: 3, who: "Citizen", title: "FIND SAFE ROUTE", how: "Route to Balkumari Evacuation Centre over the Riverside Link Bridge.", link: { href: "/citizen/route", label: "Open safe route" } },
    { n: 4, who: "Presenter", title: "Bridge floods → route updates", how: "Press “Flood the bridge” below (or on the route screen). Citizen sees ROUTE UPDATED.", done: bridgeBlocked },
    { n: 5, who: "Citizen", title: "Press EMERGENCY SOS", how: "Tap “Fill demo scenario”: 5 people, 2 children, 1 elderly, injured, water rising rapidly.", link: { href: "/citizen/sos", label: "Open SOS" }, done: Boolean(demoSos) },
    { n: 6, who: "Citizen", title: "SOS receives CRITICAL", how: "Reference SOS-NEP-#### with CRITICAL priority and the transparent score (71).", done: demoSos?.priority_level === "critical" },
    { n: 7, who: "Operator", title: "Dashboard receives it instantly", how: "Toast + NEW card at the top of the incident queue.", link: { href: "/dashboard", label: "Operations" }, done: Boolean(demoSos) },
    { n: 8, who: "Operator", title: "Open the incident", how: "View Incident → auto-acknowledged (“Control centre notified”).", done: Boolean(demoSos && demoSos.status !== "received") },
    { n: 9, who: "Operator", title: "Assign Rescue Team R-03", how: "Assign Rescue Team → R-03 (Available, 2.3 km, Boat + First Aid) → ASSIGN.", done: team?.call_sign === "R-03" || Boolean(assignment) },
    { n: 10, who: "Rescue", title: "Rescue dashboard receives the mission", how: "Sign in as Rescue Team Demo in a second browser.", link: { href: "/rescue", label: "Rescue console" }, done: Boolean(assignment) },
    { n: 11, who: "Rescue", title: "Accept Mission → EN ROUTE", how: "Tap Accept Mission, then En Route.", done: at("en_route") },
    { n: 12, who: "Citizen", title: "“Rescue Team R-03 dispatched”", how: "Citizen status screen updates live with the team card and timeline.", done: at("en_route") },
    { n: 13, who: "Rescue", title: "ARRIVED → COMPLETED", how: "Tap Arrived, Rescue In Progress, Completed.", done: assignment?.status === "completed" },
    { n: 14, who: "Operator", title: "Analytics update", how: "People assisted, teams available and charts update on Operations.", done: demoSos?.status === "resolved" },
  ];

  async function call(action: "block_bridge" | "clear_bridge" | "reset") {
    setBusy(action);
    try {
      const res = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const json = await res.json().catch(() => ({}));
      if (res.ok) toast.success(json.message);
      else toast.error(json.error ?? "Demo action failed");
      if (action === "reset" && res.ok) window.location.reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-5">
      <section className="grid content-start gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight"><FlaskConical className="size-5" aria-hidden /> Presentation mode</h1>
          <p className="text-sm text-muted-foreground">
            Hackathon demo script. Steps tick themselves from live data. Use three windows: citizen (phone size), operator (this one) and rescue.
          </p>
        </div>
        <ol className="grid gap-2">
          {steps.map((s) => (
            <li key={s.n} className={cn("flex items-start gap-3 rounded-xl border bg-card p-3", s.done && "border-safe/40 bg-safe-soft/40")}>
              {s.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-safe" aria-label="Done" /> : <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-label="Pending" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  <span className="tabular text-muted-foreground">{s.n}.</span> {s.title}{" "}
                  <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{s.who}</span>
                </p>
                <p className="text-xs text-muted-foreground">{s.how}</p>
              </div>
              {s.link && (
                <Button asChild size="sm" variant="ghost">
                  <Link href={s.link.href} target={s.who === "Operator" ? undefined : "_blank"}>
                    {s.link.label} <ExternalLink className="size-3.5" />
                  </Link>
                </Button>
              )}
            </li>
          ))}
        </ol>
      </section>

      <aside className="grid content-start gap-3">
        <SystemCheck />
        <div className="grid gap-2 rounded-xl border bg-card p-4">
          <p className="text-sm font-semibold">Scenario controls</p>
          <div className={cn("flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs", dataMode === "live" ? "bg-safe-soft text-safe-ink" : "bg-high-soft text-high-ink")}>
            <span className="font-semibold">{dataMode === "live" ? "LIVE DHM data" : "SIMULATION mode"}</span>
            <button
              type="button"
              className="cursor-pointer font-semibold underline"
              disabled={busy !== null}
              onClick={async () => {
                setBusy("mode");
                const res = await setDataMode(dataMode === "live" ? "simulation" : "live");
                setBusy(null);
                if (res.ok) toast.success(res.message ?? "Done");
                else toast.error(res.error);
              }}
            >
              {dataMode === "live" ? "Use simulation for the demo" : "Switch to live data"}
            </button>
          </div>
          {dataMode === "live" && (
            <p className="text-[11px] text-muted-foreground">The scripted steps (DANGER 84 on Narayani Riverside) need simulation mode. Reset demo data switches to it.</p>
          )}
          <Button
            variant={bridgeBlocked ? "outline" : "destructive"}
            onClick={() => call(bridgeBlocked ? "clear_bridge" : "block_bridge")}
            disabled={busy !== null}
            data-testid="demo-flood-bridge"
          >
            {busy === "block_bridge" || busy === "clear_bridge" ? <Loader2 className="animate-spin" /> : <Waves />}
            {bridgeBlocked ? "Clear bridge hazard" : "Flood the Riverside Link Bridge"}
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={busy !== null}><RotateCcw /> Reset demo data</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset the demo?</DialogTitle>
                <DialogDescription>
                  Deletes every incident, hazard report and alert (including ones created during rehearsal) and restores the simulated
                  Chitwan dataset with fresh timestamps. User accounts are kept.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <DialogClose asChild><Button variant="destructive" onClick={() => call("reset")}>Reset demo data</Button></DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-1 rounded-xl border bg-card p-4 text-sm">
          <p className="font-semibold">Live scenario state</p>
          <p className="text-muted-foreground">Bridge: <span className="font-medium text-foreground">{bridgeBlocked ? "Flooded (blocked)" : "Open"}</span></p>
          <p className="text-muted-foreground">Demo SOS: <span className="font-medium text-foreground">{demoSos ? `${demoSos.reference_code} · ${demoSos.status}` : "not sent yet"}</span></p>
          <p className="text-muted-foreground">Team: <span className="font-medium text-foreground">{team ? `${team.call_sign} · ${assignment?.status}` : "—"}</span></p>
        </div>

        <div className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Tips</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>Open the citizen app in a phone-sized window (or real phone on the same URL).</li>
            <li>Sign in as Rescue Team Demo in a private window so sessions don&apos;t clash.</li>
            <li>Reset before presenting so timestamps look fresh.</li>
            <li>All data shown is simulated; say so when presenting.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
