"use client";

import { AlertOctagon, Building2, HeartHandshake, ShieldAlert, Siren, Truck } from "lucide-react";
import { useOpsData } from "./ops-data";
import { computeKpis } from "@/lib/utilities/ops-metrics";
import { cn } from "@/lib/utils";

export function KpiCards() {
  const { sos, teams, shelters, hazards } = useOpsData();
  const k = computeKpis(sos, teams, shelters, hazards);

  const cards = [
    { label: "Active SOS", value: k.activeSos, sub: `${k.unassigned} awaiting dispatch`, icon: Siren, tone: "text-danger-ink bg-danger-soft", alert: k.unassigned > 0 },
    { label: "Critical incidents", value: k.critical, sub: "Effective priority", icon: AlertOctagon, tone: "text-white bg-danger", alert: k.critical > 0 },
    { label: "Rescue teams available", value: `${k.teamsAvailable}/${k.teamsTotal}`, sub: "Ready to dispatch", icon: Truck, tone: "text-safe-ink bg-safe-soft" },
    { label: "People assisted", value: k.peopleAssisted, sub: "Resolved in last 24 h", icon: HeartHandshake, tone: "text-info-ink bg-info-soft" },
    { label: "Active shelters", value: k.activeShelters, sub: `${k.shelterOccupancyPct}% full · ${k.shelterSpaces} spaces`, icon: Building2, tone: "text-safe-ink bg-safe-soft" },
    { label: "Open hazard reports", value: k.openHazards, sub: "Community + verified", icon: ShieldAlert, tone: "text-high-ink bg-high-soft" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className={cn("rounded-xl border bg-card p-3 shadow-xs", c.alert && "border-danger/40")}
          data-testid={`kpi-${c.label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
            <span className={cn("flex size-7 items-center justify-center rounded-lg", c.tone)}>
              <c.icon className="size-4" aria-hidden />
            </span>
          </div>
          <p className="mt-1 text-2xl font-bold tabular">{c.value}</p>
          <p className="truncate text-[11px] text-muted-foreground">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}
