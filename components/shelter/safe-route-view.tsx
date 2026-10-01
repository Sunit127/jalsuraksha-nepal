"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertOctagon,
  ArrowRight,
  Clock3,
  Construction,
  FlaskConical,
  Footprints,
  Info,
  Loader2,
  Navigation,
  RefreshCcw,
  Siren,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { LiveMap, type MapRoute } from "@/components/map";
import { useCitizenData } from "@/components/shared/citizen-data";
import { LocationChip } from "@/components/shared/location-chip";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROUTE_DISCLAIMER, findSafeRoute, type RouteResult } from "@/lib/routing/safe-route";
import { HAZARD_TYPE_LABEL } from "@/lib/utilities/format";
import { formatDistance } from "@/lib/utilities/geo";
import { cn } from "@/lib/utils";

export function SafeRouteView() {
  const router = useRouter();
  const params = useSearchParams();
  const { location, shelters, hazards, zones, demoMode, hospitals, dataMode } = useCitizenData();
  const shelterId = params.get("shelter");
  const avoidId = params.get("avoid");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const previousKey = useRef<string | null>(null);

  // Offline demo network: always computed (instant, works without internet);
  // used in simulation mode and whenever real-road routing is unavailable.
  const local = useMemo(() => {
    if (!location.location) return null;
    return findSafeRoute({
      from: location.location,
      shelters,
      hazards,
      zones,
      shelterId,
      avoidHazardIds: avoidId ? [avoidId] : [],
    });
  }, [location.location, shelters, hazards, zones, shelterId, avoidId]);

  // Live mode: hazard-aware route over real OpenStreetMap roads (Valhalla),
  // recalculated whenever the location, destination, hazards or capacity change.
  const [remote, setRemote] = useState<{ sig: string; result: RouteResult } | null>(null);
  const [engine, setEngine] = useState<"valhalla" | "offline" | null>(null);
  const from = location.location;
  const sig = from
    ? JSON.stringify([
        from.lat.toFixed(4),
        from.lng.toFixed(4),
        shelterId,
        avoidId,
        hazards.map((h) => `${h.id}:${h.status}`).join(","),
        shelters.map((s) => `${s.id}:${s.remaining_capacity}`).join(","),
      ])
    : null;
  useEffect(() => {
    if (!sig || !from || dataMode === "simulation") return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from, shelterId, avoidHazardIds: avoidId ? [avoidId] : [] }),
          signal: ctrl.signal,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.result) {
          setEngine("offline");
          return;
        }
        setRemote({ sig, result: json.result as RouteResult });
        setEngine("valhalla");
      } catch {
        if (!ctrl.signal.aborted) setEngine("offline");
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sig captures every input
  }, [sig, dataMode]);

  const usingRealRoads = dataMode === "live" && engine !== "offline";
  const result = !usingRealRoads ? local : (remote?.result ?? null);

  // Detect live re-routing (e.g. a bridge reported flooded while navigating).
  const key = result?.status === "ok" ? result.key : result?.status ?? null;
  useEffect(() => {
    if (!key) return;
    const prev = previousKey.current;
    previousKey.current = key;
    if (prev && prev !== key && result?.status === "ok") {
      setUpdatedAt(Date.now());
      if ("vibrate" in navigator) navigator.vibrate?.([150, 80, 150]);
    }
  }, [key, result?.status]);

  async function demo(action: "block_bridge" | "clear_bridge") {
    setDemoBusy(true);
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) toast.error(json.error ?? "Demo action failed");
    } finally {
      setDemoBusy(false);
    }
  }

  const routes: MapRoute[] = [];
  if (result?.status === "ok") {
    if (result.blockedBaseline) {
      routes.push({ id: "blocked", variant: "blocked", path: result.blockedBaseline.path, label: "Normal route — blocked" });
    }
    routes.push({ id: "safe", variant: "safe", path: result.path, label: "Safe route" });
  }

  const fit = useMemo(
    () =>
      result?.status === "ok"
        ? { key: result.key, points: [...result.path, ...(result.blockedBaseline?.path ?? [])] }
        : location.location
          ? { key: "loc", points: [location.location] }
          : undefined,
    [result, location.location],
  );

  const bridgeBlocked = hazards.some((h) => h.type === "blocked_bridge" && (h.status === "open" || h.status === "verified") && h.location_name?.includes("Riverside Link"));
  const openShelters = shelters.filter((s) => (s.remaining_capacity ?? 0) > 0);

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] flex-col">
      <div className="relative min-h-0 flex-1">
        <LiveMap
          className="h-full rounded-none border-0"
          center={location.location ?? { lat: 27.6925, lng: 84.4235 }}
          zoom={15}
          zones={zones}
          shelters={shelters}
          hazards={hazards}
          hospitals={hospitals}
          userLocation={location.location}
          routes={routes}
          fitBounds={fit}
          compact
        />
        <div className="absolute top-2 right-2 left-28 z-[500]">
          <LocationChip className="shadow-md" />
        </div>
        {updatedAt && result?.status === "ok" && (
          <div
            role="alert"
            className="absolute inset-x-3 top-14 z-[600] flex items-start gap-3 rounded-xl bg-high-strong p-3 text-white shadow-lg animate-in fade-in slide-in-from-top-4"
            data-testid="route-updated"
          >
            <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="text-sm">
              <p className="font-bold tracking-wide">ROUTE UPDATED</p>
              <p>Hazard detected ahead. Alternative route selected.</p>
            </div>
            <button type="button" onClick={() => setUpdatedAt(null)} className="ml-auto cursor-pointer text-xs font-semibold underline">
              OK
            </button>
          </div>
        )}
      </div>

      <section className="max-h-[52%] overflow-y-auto rounded-t-2xl border-t bg-card px-4 pt-4 pb-24 shadow-[0_-8px_24px_-12px_rgb(15_23_42/.25)]">
        {!location.location ? (
          <div className="grid gap-2 text-sm">
            <p className="font-semibold">Waiting for your location…</p>
            <p className="text-muted-foreground">Allow location access to calculate a route, or pick a shelter from the list.</p>
            <Button asChild variant="outline"><Link href="/citizen/shelters">See shelters</Link></Button>
          </div>
        ) : !result ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Calculating a safe route on real roads…</p>
        ) : result.status !== "ok" ? (
          <div className="grid gap-3">
            <div className="flex items-start gap-3 rounded-xl bg-danger-soft p-3 text-danger-ink">
              <AlertOctagon className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div className="text-sm">
                <p className="font-bold">{result.status === "no_route" ? "ROUTE UNAVAILABLE" : result.status === "no_shelter" ? "NO SHELTER AVAILABLE" : "OUTSIDE MAPPED AREA"}</p>
                <p>{result.message}</p>
                {result.status === "no_route" && result.blockedBy.length > 0 && (
                  <p className="mt-1 text-xs">Blocked by: {result.blockedBy.map((h) => `${HAZARD_TYPE_LABEL[h.type]} (${h.location_name ?? "reported"})`).join(", ")}</p>
                )}
              </div>
            </div>
            <Button asChild variant="destructive" size="lg"><Link href="/citizen/sos"><Siren /> Send SOS</Link></Button>
            {shelterId && <Button variant="outline" onClick={() => router.replace("/citizen/route")}>Try nearest available shelter</Button>}
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="label-caps text-safe-ink">Safe route to</p>
                <h1 className="text-lg font-bold leading-tight">{result.shelter.name}</h1>
                <p className="text-xs text-muted-foreground">
                  {result.shelter.remaining_capacity} spaces available · {result.shelter.current_occupancy}/{result.shelter.capacity}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xl font-bold tabular">{formatDistance(result.distanceM)}</p>
                <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  <Footprints className="size-3.5" aria-hidden /><Clock3 className="size-3.5" aria-hidden /> ~{result.walkingMinutes} min walk
                </p>
              </div>
            </div>

            {result.blockedBaseline && (
              <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger-ink" data-testid="route-blocked-note">
                <Construction className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p>
                  <span className="font-semibold">Normal route unavailable</span> — blocked by{" "}
                  {result.blockedBaseline.blockedBy.map((h) => `${HAZARD_TYPE_LABEL[h.type].toLowerCase()} at ${h.location_name ?? "reported location"}`).join(", ")}.
                  Showing a safer alternative (red dashed line = blocked).
                </p>
              </div>
            )}

            <ol className="flex flex-wrap items-center gap-1 text-xs" aria-label="Route via">
              {result.waypoints.map((w, i) => (
                <li key={`${w}-${i}`} className="flex items-center gap-1">
                  <span className="rounded-md bg-muted px-2 py-1 font-medium">{w}</span>
                  {i < result.waypoints.length - 1 && <ArrowRight className="size-3 text-muted-foreground" aria-hidden />}
                </li>
              ))}
            </ol>

            {result.cautions.length > 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-watch-soft p-2 text-xs text-watch-ink">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Caution on route: {result.cautions.map((h) => `${HAZARD_TYPE_LABEL[h.type]} (${h.severity})`).join(", ")}.
              </p>
            )}

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Button asChild variant="safe" size="lg">
                <a
                  href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${location.location.lat}%2C${location.location.lng}%3B${result.shelter.latitude}%2C${result.shelter.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Navigation /> START NAVIGATION
                </a>
              </Button>
              <Button variant="outline" size="lg" aria-label="Recalculate route" onClick={() => { router.refresh(); toast.info("Route recalculated with the latest reports."); }}>
                <RefreshCcw />
              </Button>
            </div>

            <Select value={shelterId ?? "nearest"} onValueChange={(v) => router.replace(v === "nearest" ? "/citizen/route" : `/citizen/route?shelter=${v}`)}>
              <SelectTrigger aria-label="Destination shelter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nearest">Nearest shelter with space (recommended)</SelectItem>
                {openShelters.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.remaining_capacity} spaces</SelectItem>)}
              </SelectContent>
            </Select>

            {avoidId && <p className="text-xs text-muted-foreground">Avoiding the hazard you selected on the map.</p>}

            <p className="flex gap-2 rounded-lg bg-muted p-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {ROUTE_DISCLAIMER}{" "}
              {usingRealRoads
                ? "Route on real roads (OpenStreetMap), going around reported blocking hazards."
                : dataMode === "simulation"
                  ? "Demo road network (simulation)."
                  : "Approximate route: real-road routing is unavailable right now, so this uses the simplified offline network around Bharatpur."}{" "}
              The external navigation link uses OpenStreetMap routing, which does not know about reported hazards.
            </p>

            {demoMode && (
              <div className="grid gap-2 rounded-xl border border-dashed p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><FlaskConical className="size-3.5" aria-hidden /> Presentation controls</p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={demoBusy}
                  onClick={() => demo(bridgeBlocked ? "clear_bridge" : "block_bridge")}
                  className={cn(!bridgeBlocked && "border-danger/40 text-danger-ink")}
                  data-testid="demo-bridge-toggle"
                >
                  {demoBusy && <Loader2 className="animate-spin" />}
                  {bridgeBlocked ? "Clear bridge hazard" : "Simulate: Riverside Link Bridge floods"}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
