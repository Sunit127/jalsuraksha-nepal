"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HeartHandshake, Phone } from "lucide-react";
import { SafetyStatusBadge } from "@/components/shared/status-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPhone, timeAgo } from "@/lib/utilities/format";
import { isSosOpen } from "@/lib/utilities/status";
import { cn } from "@/lib/utils";
import { useOpsData } from "./ops-data";

const ORDER = { need_help: 0, evacuated: 1, safe: 2, unknown: 3 } as const;

/**
 * Citizens' own family-safety reports (profile: SAFE / EVACUATED / NEED HELP),
 * live. NEED HELP is listed first and linked to the person's open SOS if any.
 */
export function FamilySafetyPanel() {
  const { citizens, sos } = useOpsData();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const counts = useMemo(() => {
    const c = { need_help: 0, evacuated: 0, safe: 0 };
    for (const p of citizens) if (p.safety_status in c) c[p.safety_status as keyof typeof c] += 1;
    return c;
  }, [citizens]);

  const list = useMemo(
    () =>
      [...citizens]
        .sort(
          (a, b) =>
            ORDER[a.safety_status] - ORDER[b.safety_status] ||
            new Date(b.safety_updated_at ?? 0).getTime() - new Date(a.safety_updated_at ?? 0).getTime(),
        )
        .slice(0, 12),
    [citizens],
  );

  return (
    <Card id="family-safety" className="scroll-mt-20">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <HeartHandshake className="size-4" aria-hidden /> Family safety reports
        </CardTitle>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={cn("rounded-full px-2 py-0.5 font-semibold", counts.need_help ? "bg-danger text-white" : "bg-muted text-muted-foreground")}>
            {counts.need_help} need help
          </span>
          <span className="rounded-full bg-info-soft px-2 py-0.5 font-semibold text-info-ink">{counts.evacuated} evacuated</span>
          <span className="rounded-full bg-safe-soft px-2 py-0.5 font-semibold text-safe-ink">{counts.safe} safe</span>
        </div>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No reports yet. Citizens set SAFE, EVACUATED or NEED HELP on their profile; changes appear here instantly.
          </p>
        ) : (
          <ul className="divide-y">
            {list.map((p) => {
              const openSos = sos.find((s) => s.user_id === p.id && isSosOpen(s.status));
              const where = [p.ward ? `Ward ${p.ward}` : null, p.municipality, p.district].filter(Boolean).join(", ");
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <SafetyStatusBadge status={p.safety_status} />
                      <span className="truncate">{p.full_name ?? "Unnamed citizen"}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[p.phone ? formatPhone(p.phone) : null, where || null, p.emergency_contact ? `family contact ${formatPhone(p.emergency_contact)}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                      {p.safety_updated_at ? ` · ${timeAgo(p.safety_updated_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {openSos && (
                      <Link href={`/dashboard/incidents/${openSos.id}`} className="text-xs font-semibold text-primary hover:underline">
                        {openSos.reference_code}
                      </Link>
                    )}
                    {p.phone && (
                      <a
                        href={`tel:+${p.phone.replace(/^\+/, "")}`}
                        className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent"
                        aria-label={`Call ${p.full_name ?? "citizen"}`}
                      >
                        <Phone className="size-3.5" aria-hidden /> Call
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
