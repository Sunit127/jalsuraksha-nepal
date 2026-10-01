"use client";

import { useEffect, useState } from "react";
import { MessageSquareText, Phone, RefreshCcw, WifiOff } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { EMERGENCY_CONTACTS, SAFETY_INSTRUCTIONS } from "@/lib/demo/scenario";
import { timeAgo } from "@/lib/utilities/format";

type Snapshot = {
  fetchedAt?: string;
  alerts?: { id: string; title: string; severity: string; description: string }[];
  shelters?: { id: string; name: string; address: string; remaining_capacity: number | null; contact_phone: string | null }[];
};

/** Works with zero network: reads the last snapshot saved by the app. */
export function OfflineView() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("js:public-snapshot:v1");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only cache
      if (raw) setSnap(JSON.parse(raw));
    } catch {
      // No cached data available.
    }
  }, []);

  return (
    <div className="mx-auto grid min-h-dvh max-w-md content-start gap-4 bg-background p-4">
      <Logo />
      <div className="flex items-start gap-3 rounded-2xl bg-slate-900 p-4 text-white">
        <WifiOff className="mt-0.5 size-6 shrink-0 text-amber-300" aria-hidden />
        <div>
          <p className="font-bold tracking-wide">OFFLINE MODE</p>
          <p className="text-sm text-slate-300">
            Last synchronized: {snap?.fetchedAt ? timeAgo(snap.fetchedAt) : "not available"}. Information below may be out of date.
          </p>
        </div>
      </div>

      <section className="grid gap-2">
        <h1 className="text-sm font-semibold">Emergency numbers</h1>
        <div className="grid grid-cols-3 gap-2">
          {EMERGENCY_CONTACTS.map((c) => (
            <a key={c.number} href={`tel:${c.number}`} className="flex flex-col items-center rounded-xl border bg-card py-3 text-center">
              <span className="flex items-center gap-1 text-lg font-bold"><Phone className="size-4" aria-hidden />{c.number}</span>
              <span className="text-xs text-muted-foreground">{c.name}</span>
            </a>
          ))}
        </div>
        <p className="flex items-start gap-2 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
          <MessageSquareText className="mt-0.5 size-4 shrink-0" aria-hidden />
          SMS SOS (“SOS 5 2 1”) is planned for a future version with a telecom partner — it is not active in this prototype.
        </p>
      </section>

      {snap?.alerts && snap.alerts.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-sm font-semibold">Last known alerts</h2>
          {snap.alerts.slice(0, 3).map((a) => (
            <div key={a.id} className="rounded-xl border bg-card p-3">
              <p className="text-xs font-bold uppercase">{a.severity}</p>
              <p className="font-semibold">{a.title}</p>
              <p className="text-sm text-muted-foreground">{a.description}</p>
            </div>
          ))}
        </section>
      )}

      {snap?.shelters && snap.shelters.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-sm font-semibold">Shelters (last known capacity)</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {snap.shelters.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{s.address}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold">{(s.remaining_capacity ?? 0) > 0 ? `${s.remaining_capacity} spaces` : "FULL"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-2 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Flood safety</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {SAFETY_INSTRUCTIONS.map((s) => <li key={s}>{s}</li>)}
        </ul>
      </section>

      <Button onClick={() => window.location.reload()}><RefreshCcw /> Try again</Button>
    </div>
  );
}
