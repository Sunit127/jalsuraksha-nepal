"use client";

import { AlertCard } from "@/components/alerts/alert-card";
import { useCitizenData } from "@/components/shared/citizen-data";
import { PushAlertsToggle } from "@/components/alerts/push-alerts-toggle";

export default function AlertsPage() {
  const { alerts } = useCitizenData();
  return (
    <div className="grid gap-3">
      <h1 className="text-xl font-bold">Active alerts</h1>
      <PushAlertsToggle variant="inline" />
      {alerts.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No active alerts right now.
        </p>
      ) : (
        alerts.map((a) => <AlertCard key={a.id} alert={a} />)
      )}
    </div>
  );
}
