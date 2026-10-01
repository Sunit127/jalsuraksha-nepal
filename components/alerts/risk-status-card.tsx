"use client";

import { useState } from "react";
import { AlertOctagon, AlertTriangle, ChevronDown, Eye, MapPin, ShieldCheck } from "lucide-react";
import { RISK_CATEGORY_LABEL, type RiskCategory } from "@/lib/risk-engine/flood-risk";
import type { ScoredZone } from "@/lib/risk-engine/zones";
import { cn } from "@/lib/utils";
import type { LiveRiskZone } from "@/lib/hydromet/live";
import type { RiskZone } from "@/types/domain";
import { DemoBadge } from "@/components/shared/status-badges";
import { RiskExplanation } from "./risk-explanation";

const STYLE: Record<RiskCategory, { wrap: string; icon: typeof AlertOctagon; headline: string }> = {
  danger: { wrap: "bg-danger text-white", icon: AlertOctagon, headline: "FLOOD DANGER" },
  high: { wrap: "bg-high-strong text-white", icon: AlertTriangle, headline: "HIGH FLOOD RISK" },
  watch: { wrap: "bg-watch text-slate-900", icon: Eye, headline: "FLOOD WATCH" },
  safe: { wrap: "bg-safe-strong text-white", icon: ShieldCheck, headline: "LOW FLOOD RISK" },
};

export function RiskStatusCard({
  zone,
  isUserZone,
  locationLabel,
}: {
  zone: ScoredZone<RiskZone> | null;
  isUserZone: boolean;
  locationLabel: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (!zone) {
    return (
      <section className="rounded-2xl border bg-card p-4">
        <p className="label-caps text-muted-foreground">Current risk</p>
        <p className="mt-1 text-sm text-muted-foreground">
          No risk data available yet. Alerts and shelters are still shown below.
        </p>
      </section>
    );
  }

  const s = STYLE[zone.risk.category];
  const topFactors = [...zone.risk.factors].sort((a, b) => b.contribution - a.contribution).slice(0, 2);

  return (
    <section aria-labelledby="risk-heading" className="overflow-hidden rounded-2xl border shadow-sm">
      <div className={cn("p-4", s.wrap)}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label-caps">{isUserZone ? "Risk at your location" : "Highest risk in region"}</p>
            <h2 id="risk-heading" className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight">
              <s.icon className="size-7 shrink-0" aria-hidden />
              {s.headline}
            </h2>
            <p className="mt-1 font-medium">
              {zone.name} · {zone.river_basin} Basin
            </p>
          </div>
          <div className="rounded-xl bg-black/15 px-3 py-2 text-center">
            <p className="text-2xl font-bold leading-none tabular">{zone.risk.score}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide">
              {RISK_CATEGORY_LABEL[zone.risk.category]}
            </p>
          </div>
        </div>
        {locationLabel && (
          <p className="mt-3 flex items-center gap-1.5 text-xs">
            <MapPin className="size-3.5" aria-hidden /> {locationLabel}
          </p>
        )}
      </div>
      <div className="bg-card p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full cursor-pointer items-center justify-between gap-2 text-left text-sm font-semibold"
        >
          <span>
            {
              {
                safe: "Why is the risk low here?",
                watch: "Why is this area on flood watch?",
                high: "Why is the flood risk high here?",
                danger: "Why is this area in flood danger?",
              }[zone.risk.category]
            }
            {!open && (
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                {topFactors.map((f) => `${f.label} +${f.contribution}`).join(" · ")}
              </span>
            )}
          </span>
          <ChevronDown className={cn("size-4 shrink-0 transition", open && "rotate-180")} aria-hidden />
        </button>
        {open && <RiskExplanation risk={zone.risk} className="mt-3" />}
        {(zone as Partial<LiveRiskZone>).reading?.mode === "live" ? (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="rounded bg-safe-soft px-1.5 py-0.5 font-bold text-safe-ink">LIVE</span> Real-time DHM river &amp; rainfall readings
            · decision support, not a forecast
          </div>
        ) : (
          zone.source_type === "simulated" && (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
              <DemoBadge label="SIMULATION" /> Simulated river &amp; rainfall inputs — not real readings
            </div>
          )
        )}
      </div>
    </section>
  );
}
