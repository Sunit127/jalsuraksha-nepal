"use client";

import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  INCIDENT_FILTER_LABEL,
  matchesFilter,
  sortIncidents,
  type IncidentFilter,
  type IncidentSort,
} from "@/lib/utilities/ops-metrics";
import { cn } from "@/lib/utils";
import { IncidentCard } from "./incident-card";
import { useOpsData } from "./ops-data";

const FILTERS: IncidentFilter[] = ["open", "critical", "high", "unassigned", "assigned", "completed"];

export function IncidentQueue({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { sos } = useOpsData();
  const [filter, setFilter] = useState<IncidentFilter>("open");
  const [sort, setSort] = useState<IncidentSort>("priority");

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f, sos.filter((s) => matchesFilter(s, f)).length])) as Record<IncidentFilter, number>,
    [sos],
  );
  const list = useMemo(
    () => sortIncidents(sos.filter((s) => matchesFilter(s, filter)), sort),
    [sos, filter, sort],
  );

  return (
    <section aria-labelledby="queue-title" className="flex h-full min-h-0 flex-col rounded-xl border bg-muted/40">
      <div className="grid gap-2 border-b bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="queue-title" className="text-sm font-semibold">Incident queue</h2>
          <Select value={sort} onValueChange={(v) => setSort(v as IncidentSort)}>
            <SelectTrigger className="h-8 w-40 text-xs" aria-label="Sort incidents">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Sort: Priority</SelectItem>
              <SelectItem value="time">Sort: Newest</SelectItem>
              <SelectItem value="location">Sort: Location</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter incidents">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition",
                filter === f ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
              )}
            >
              {INCIDENT_FILTER_LABEL[f]} <span className="tabular opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 [&>*]:shrink-0" aria-live="polite">
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Inbox className="size-6" aria-hidden />
            No incidents match this filter.
          </div>
        ) : (
          list.map((s) => (
            <IncidentCard key={s.id} sos={s} selected={s.id === selectedId} onSelect={() => onSelect(s.id)} />
          ))
        )}
      </div>
    </section>
  );
}
