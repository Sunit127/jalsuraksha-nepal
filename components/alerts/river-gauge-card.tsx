import { ArrowDownRight, ArrowRight, ArrowUpRight, CloudRain, FlaskConical, Radio, Waves } from "lucide-react";
import type { LiveRiskZone } from "@/lib/hydromet/live";
import { timeAgo } from "@/lib/utilities/format";
import { cn } from "@/lib/utils";

function Trend({ trend }: { trend: string | null }) {
  const t = (trend ?? "").toUpperCase();
  if (t === "RISING") return <span className="inline-flex items-center gap-0.5 text-danger-ink"><ArrowUpRight className="size-3.5" aria-hidden /> Rising</span>;
  if (t === "FALLING") return <span className="inline-flex items-center gap-0.5 text-safe-ink"><ArrowDownRight className="size-3.5" aria-hidden /> Falling</span>;
  if (t === "STEADY") return <span className="inline-flex items-center gap-0.5 text-muted-foreground"><ArrowRight className="size-3.5" aria-hidden /> Steady</span>;
  return null;
}

/**
 * River level vs official warning/danger thresholds, plus 24 h rainfall.
 * Always states where the numbers come from: a live DHM gauge (with its
 * reading time), no recent reading, or the labelled simulation.
 */
export function RiverGaugeCard({ zone }: { zone: LiveRiskZone }) {
  const { reading } = zone;
  const live = reading.mode === "live";
  const river = reading.river;
  const showBar = !live || Boolean(river?.fresh);

  const level = Number(zone.river_level_m);
  const warning = Number(zone.warning_level_m);
  const danger = Number(zone.danger_level_m);
  const dangerKnown = !(live && river?.dangerEstimated);
  const max = Math.max(danger * 1.15, level * 1.05, warning * 1.2);
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  const state = dangerKnown && level >= danger ? "Above danger level" : level >= warning ? "Above warning level" : "Below warning level";

  const rainFresh = !live || Boolean(reading.rain?.fresh);
  const rain = Number(zone.rainfall_mm_24h);

  return (
    <section className="grid gap-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label-caps flex items-center gap-1.5 text-muted-foreground">
          <Waves className="size-3.5" aria-hidden /> {(zone.river_name ?? zone.river_basin).split(" (")[0]} river level
        </p>
        {live ? (
          <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", river?.fresh ? "bg-safe-soft text-safe-ink" : "bg-muted text-muted-foreground")}>
            <Radio className="size-3" aria-hidden /> {river?.fresh ? "Live · DHM" : "No recent reading"}
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-high-soft px-2 py-0.5 text-[10px] font-bold uppercase text-high-ink">
            <FlaskConical className="size-3" aria-hidden /> Simulation
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-4">
        <div>
          {showBar ? (
            <>
              <p className="text-xl font-bold tabular">
                {level.toFixed(2)} m{" "}
                <span
                  className={cn(
                    "text-xs font-semibold",
                    dangerKnown && level >= danger ? "text-danger-ink" : level >= warning ? "text-high-ink" : "text-safe-ink",
                  )}
                >
                  {state}
                </span>
              </p>
              <div className="relative mt-3 h-2.5 rounded-full bg-muted" role="img" aria-label={`River at ${level} metres; warning ${warning} m${dangerKnown ? `, danger ${danger} m` : ""}`}>
                <div
                  className={cn("absolute inset-y-0 left-0 rounded-full", dangerKnown && level >= danger ? "bg-danger" : level >= warning ? "bg-high" : "bg-info")}
                  style={{ width: pct(level) }}
                />
                <span className="absolute -top-1 h-4.5 w-0.5 bg-high" style={{ left: pct(warning) }} />
                {dangerKnown && <span className="absolute -top-1 h-4.5 w-0.5 bg-danger" style={{ left: pct(danger) }} />}
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                <span>Warning {warning.toFixed(1)} m</span>
                <span>{dangerKnown ? `Danger ${danger.toFixed(1)} m` : "No official danger level"}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {river
                ? `No recent reading from the ${river.stationName} gauge${river.observedAt ? ` (last report ${timeAgo(river.observedAt)})` : ""}. River level is not included in the risk score until it reports again.`
                : "No DHM river gauge on this river nearby. River level is not included in the risk score."}
            </p>
          )}
        </div>
        <div className={cn("flex min-w-24 flex-col items-center justify-center rounded-xl px-3", rainFresh ? "bg-info-soft text-info-ink" : "bg-muted text-muted-foreground")}>
          <CloudRain className="size-5" aria-hidden />
          <p className="mt-1 text-xl font-bold tabular">{rainFresh ? Math.round(rain) : "—"}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide">mm / 24 h</p>
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
        {live ? (
          <>
            {river?.fresh && (
              <>
                <span className="font-medium text-foreground">{river.stationName}</span>
                <span>· {river.observedAt ? timeAgo(river.observedAt) : ""}</span>
                <Trend trend={river.trend} />
              </>
            )}
            {reading.rain?.fresh && <span>· rain: {reading.rain.stationName}</span>}
            <span className="basis-full">Source: DHM (hydrology.gov.np) via BIPAD portal — official real-time readings, not a forecast.</span>
          </>
        ) : (
          <span>Simulated demo readings for presentations and drills — not real river levels.</span>
        )}
      </p>
    </section>
  );
}
