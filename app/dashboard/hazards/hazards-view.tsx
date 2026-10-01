"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Copy, ShieldCheck, ThumbsUp, XCircle } from "lucide-react";
import { toast } from "sonner";
import { reviewHazard } from "@/app/dashboard/actions";
import { useOpsData } from "@/components/dashboard/ops-data";
import { DemoBadge, HazardSeverityBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { HAZARD_TYPE_LABEL, timeAgo } from "@/lib/utilities/format";
import { cn } from "@/lib/utils";
import type { HazardReport, HazardStatus } from "@/types/domain";

const TABS: { key: HazardStatus | "all"; label: string }[] = [
  { key: "open", label: "Needs review" },
  { key: "verified", label: "Verified" },
  { key: "resolved", label: "Resolved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default function HazardsPage() {
  const { hazards } = useOpsData();
  const [tab, setTab] = useState<HazardStatus | "all">("open");
  const primaries = hazards.filter((h) => !h.duplicate_of && (tab === "all" || h.status === tab));
  const duplicatesOf = (id: string) => hazards.filter((h) => h.duplicate_of === id);

  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:p-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Community hazard reports</h1>
        <p className="text-sm text-muted-foreground">
          Verify reports to confirm them for citizens and routing. Nearby duplicates are grouped automatically.
        </p>
      </div>
      <div className="flex flex-wrap gap-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium",
              tab === t.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
            )}
          >
            {t.label}{" "}
            <span className="opacity-70">
              {hazards.filter((h) => !h.duplicate_of && (t.key === "all" || h.status === t.key)).length}
            </span>
          </button>
        ))}
      </div>
      {primaries.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nothing here.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {primaries.map((h) => (
            <HazardRow key={h.id} hazard={h} duplicates={duplicatesOf(h.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function HazardRow({ hazard: h, duplicates }: { hazard: HazardReport; duplicates: HazardReport[] }) {
  const [pending, startTransition] = useTransition();
  const set = (status: HazardStatus) =>
    startTransition(async () => {
      const res = await reviewHazard({ reportId: h.id, status });
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });

  return (
    <article className="grid gap-2 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{HAZARD_TYPE_LABEL[h.type]}</p>
          <p className="text-xs text-muted-foreground">{h.location_name ?? `${h.latitude.toFixed(4)}, ${h.longitude.toFixed(4)}`} · {timeAgo(h.created_at)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <HazardSeverityBadge severity={h.severity} />
          <span className="text-xs capitalize text-muted-foreground">{h.status}</span>
        </div>
      </div>
      {h.description && <p className="text-sm">{h.description}</p>}
      {h.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded image from storage
        <img src={h.photo_url} alt={`Photo of ${HAZARD_TYPE_LABEL[h.type]}`} className="max-h-40 rounded-lg object-cover" />
      )}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><ThumbsUp className="size-3.5" aria-hidden /> Confirmed by {h.confirmation_count}</span>
        {duplicates.length > 0 && (
          <span className="flex items-center gap-1"><Copy className="size-3.5" aria-hidden /> {duplicates.length} grouped duplicate{duplicates.length > 1 ? "s" : ""}</span>
        )}
        {h.source_type === "simulated" && <DemoBadge />}
      </div>
      <div className="flex flex-wrap gap-2 border-t pt-2">
        {h.status !== "verified" && (
          <Button size="sm" onClick={() => set("verified")} disabled={pending}><ShieldCheck /> Verify</Button>
        )}
        {h.status !== "resolved" && (
          <Button size="sm" variant="outline" onClick={() => set("resolved")} disabled={pending}><CheckCircle2 /> Resolved</Button>
        )}
        {h.status !== "rejected" && (
          <Button size="sm" variant="ghost" className="text-danger-ink" onClick={() => set("rejected")} disabled={pending}><XCircle /> Reject</Button>
        )}
        {(h.status === "resolved" || h.status === "rejected") && (
          <Button size="sm" variant="ghost" onClick={() => set("open")} disabled={pending}>Reopen</Button>
        )}
      </div>
    </article>
  );
}
