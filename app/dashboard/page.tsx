"use client";

import { useState } from "react";
import { AnalyticsPanel } from "@/components/dashboard/analytics-panel";
import { FamilySafetyPanel } from "@/components/dashboard/family-safety-panel";
import { IncidentQueue } from "@/components/dashboard/incident-queue";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { useOpsData } from "@/components/dashboard/ops-data";
import { LiveMap } from "@/components/map";
import { DEMO_REGION } from "@/lib/demo/scenario";
import { isSosOpen } from "@/lib/utilities/status";

export default function OperationsPage() {
  const data = useOpsData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const openSos = data.sos.filter((s) => isSosOpen(s.status));

  // A new incident is selected as it arrives so the map flies to the caller,
  // even when they are outside the area currently in view.
  const [seenIds, setSeenIds] = useState(() => new Set(openSos.map((s) => s.id)));
  const arrived = openSos.find((s) => !seenIds.has(s.id));
  if (arrived) {
    setSeenIds(new Set(openSos.map((s) => s.id)));
    setSelectedId(arrived.id);
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Operations overview</h1>
          <p className="text-sm text-muted-foreground">
            Narayani basin · Chitwan &amp; Nawalpur ·{" "}
            {data.dataMode === "live" ? "live DHM river & rainfall data" : "SIMULATION — demo scenario, not real readings"}
          </p>
        </div>
      </div>

      <KpiCards />

      <div className="grid grid-cols-1 gap-4 lg:h-[640px] lg:grid-cols-[minmax(0,1fr)_400px]">
        <LiveMap
          className="h-[420px] lg:h-full"
          center={DEMO_REGION.center}
          zoom={13}
          zones={data.zones}
          shelters={data.shelters}
          hospitals={data.hospitals}
          hazards={data.hazards}
          teams={data.teamsLive}
          sos={openSos}
          selectedSosId={selectedId}
          onSosSelect={(s) => setSelectedId(s.id)}
        />
        <div className="h-[560px] min-h-0 lg:h-full">
          <IncidentQueue selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </div>

      <FamilySafetyPanel />

      <AnalyticsPanel />
    </div>
  );
}
