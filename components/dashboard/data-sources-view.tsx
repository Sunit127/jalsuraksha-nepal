"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudRain, Database, FlaskConical, Loader2, Radio, RefreshCcw, Waves } from "lucide-react";
import { toast } from "sonner";
import { reimportReferenceData, runHydrometSync, setDataMode } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { gaugeAlertLevel, isFresh, RAIN_FRESH_HOURS, RIVER_FRESH_HOURS } from "@/lib/hydromet/live";
import { PILOT_AREA } from "@/lib/geo/pilot-area";
import { timeAgo } from "@/lib/utilities/format";
import { cn } from "@/lib/utils";
import { useOpsData } from "./ops-data";

export type ReferenceCounts = {
  wards: number;
  hospitals: number;
  healthFacilities: number;
  helipads: number;
  fireStations: number;
  sheltersOpen: number;
  sheltersVerified: number;
  sheltersCandidates: number;
  sheltersDemo: number;
};

/** Where every number in the app comes from, and the controls for it. */
export function DataSourcesView({ counts, isAdmin }: { counts: ReferenceCounts; isAdmin: boolean }) {
  const { dataMode, stations, hydrometSync, zones } = useOpsData();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.message ?? "Done");
      else toast.error(res.error ?? "Failed");
      router.refresh();
    });

  const rivers = stations.filter((s) => s.kind === "river").sort((a, b) => a.name.localeCompare(b.name));
  const rains = stations
    .filter((s) => s.kind === "rain" && isFresh(s.observed_at, RAIN_FRESH_HOURS))
    .sort((a, b) => Number(b.rain_24h_mm ?? 0) - Number(a.rain_24h_mm ?? 0));
  const staleRain = stations.filter((s) => s.kind === "rain").length - rains.length;
  const usedBy = (id: string) => zones.filter((z) => z.reading.river?.stationId === id).map((z) => z.name);

  return (
    <div className="grid gap-4 p-4 lg:p-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Data sources</h1>
        <p className="text-sm text-muted-foreground">
          Pilot area: {PILOT_AREA.name}. Every reading shows its source and age; stale readings are never used as current.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            {dataMode === "live" ? <Radio className="size-4 text-safe" aria-hidden /> : <FlaskConical className="size-4 text-high" aria-hidden />}
            Data mode: {dataMode === "live" ? "LIVE" : "SIMULATION"}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={dataMode === "live" ? "default" : "outline"} disabled={pending || dataMode === "live"} onClick={() => run(() => setDataMode("live"))}>
              <Radio /> Live DHM data
            </Button>
            <Button size="sm" variant={dataMode === "simulation" ? "default" : "outline"} disabled={pending || dataMode === "simulation"} onClick={() => run(() => setDataMode("simulation"))}>
              <FlaskConical /> Simulation (demo / drill)
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {dataMode === "live"
            ? "Real-time DHM river gauges and rain stations drive risk levels; gauges at or above official warning/danger levels raise alerts automatically (withdrawn when levels drop)."
            : "The demo scenario drives risk levels. Every citizen and staff screen shows a SIMULATION banner. Automatic gauge alerts are paused."}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Waves className="size-4" aria-hidden /> River gauges — DHM (hydrology.gov.np) via BIPAD portal
          </CardTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {hydrometSync ? (
              <span className={cn(!hydrometSync.ok && "text-danger-ink")}>
                Last sync {timeAgo(hydrometSync.at)}
                {!hydrometSync.ok && ` — failed: ${hydrometSync.error ?? "error"}`}
              </span>
            ) : (
              <span>Not synced yet</span>
            )}
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(runHydrometSync)}>
              {pending ? <Loader2 className="animate-spin" /> : <RefreshCcw />} Sync now
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Gauge</th>
                <th className="py-2 pr-3 font-medium">Level</th>
                <th className="py-2 pr-3 font-medium">Warning / danger</th>
                <th className="py-2 pr-3 font-medium">DHM status</th>
                <th className="py-2 pr-3 font-medium">Reading</th>
                <th className="py-2 font-medium">Used for</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rivers.map((s) => {
                const fresh = isFresh(s.observed_at, RIVER_FRESH_HOURS);
                const level = gaugeAlertLevel(s);
                return (
                  <tr key={s.id} className={cn(!fresh && "text-muted-foreground")}>
                    <td className="py-2 pr-3 font-medium">{s.name}</td>
                    <td className="py-2 pr-3 tabular">{s.water_level_m !== null ? `${Number(s.water_level_m).toFixed(2)} m` : "—"}</td>
                    <td className="py-2 pr-3 tabular">
                      {s.warning_level_m !== null ? `${Number(s.warning_level_m).toFixed(1)} m` : "—"} / {s.danger_level_m !== null ? `${Number(s.danger_level_m).toFixed(1)} m` : "not set"}
                    </td>
                    <td className="py-2 pr-3">
                      {fresh ? (
                        <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", level === "danger" ? "bg-danger text-white" : level === "warning" ? "bg-high-soft text-high-ink" : "bg-safe-soft text-safe-ink")}>
                          {(s.official_status ?? "").toLowerCase() || "—"} {s.trend ? `· ${s.trend.toLowerCase()}` : ""}
                        </span>
                      ) : (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">stale — not used</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs">{s.observed_at ? timeAgo(s.observed_at) : "never"}</td>
                    <td className="py-2 text-xs">{usedBy(s.id).join(", ") || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudRain className="size-4" aria-hidden /> Rain stations reporting now ({rains.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rains.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rain station in the pilot area has reported in the last {RAIN_FRESH_HOURS} hours.</p>
          ) : (
            <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {rains.map((s) => (
                <li key={s.id} className="flex justify-between gap-3 border-b py-1.5">
                  <span>{s.name}</span>
                  <span className="tabular text-muted-foreground">
                    {Number(s.rain_24h_mm ?? 0).toFixed(1)} mm/24 h · {s.observed_at ? timeAgo(s.observed_at) : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {staleRain > 0 && <p className="mt-2 text-xs text-muted-foreground">{staleRain} more stations have no recent reading and are ignored.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Database className="size-4" aria-hidden /> Reference data
          </CardTitle>
          {isAdmin && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(reimportReferenceData)}>
              {pending ? <Loader2 className="animate-spin" /> : <RefreshCcw />} Re-import from BIPAD &amp; OpenStreetMap
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Ward boundaries", counts.wards, "OpenStreetMap (ODbL)"],
            ["Hospitals", counts.hospitals, "BIPAD portal"],
            ["Other health facilities", counts.healthFacilities, "BIPAD portal"],
            ["Helipads", counts.helipads, "BIPAD portal"],
            ["Fire stations", counts.fireStations, "BIPAD portal"],
            ["Shelters open to citizens", counts.sheltersOpen, `${counts.sheltersVerified} verified · ${counts.sheltersDemo} demo`],
            ["Candidate shelters to verify", counts.sheltersCandidates, "Schools (BIPAD), community centres (OSM)"],
          ].map(([label, n, source]) => (
            <div key={label as string} className="rounded-xl border p-3">
              <p className="text-2xl font-bold tabular">{n}</p>
              <p className="font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{source}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
