import { Info } from "lucide-react";
import type { FloodRiskResult } from "@/lib/risk-engine/flood-risk";
import { cn } from "@/lib/utils";

/** "Why is this area high risk?" — every factor and its contribution. */
export function RiskExplanation({ risk, className }: { risk: FloodRiskResult; className?: string }) {
  const factors = [...risk.factors].sort((a, b) => b.contribution - a.contribution);
  return (
    <div className={cn("grid gap-3", className)}>
      <ul className="grid gap-2">
        {factors.map((f) => (
          <li key={f.key} className="grid gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{f.label}</span>
              <span className={cn("font-semibold tabular", f.contribution === 0 && "text-muted-foreground")}>
                +{f.contribution}
                <span className="font-normal text-muted-foreground"> / {Math.round(f.weight)}</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className="h-full rounded-full bg-primary/80"
                style={{ width: `${Math.round(f.normalized * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{f.detail}</p>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t pt-2 text-sm">
        <span className="font-semibold">Risk score</span>
        <span className="text-lg font-bold tabular">{risk.score}</span>
      </div>
      <p className="flex gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Transparent rule-based decision support: each input is scaled 0–1 and multiplied by its
        weight. Not a flood forecast. Follow official instructions.
      </p>
    </div>
  );
}
