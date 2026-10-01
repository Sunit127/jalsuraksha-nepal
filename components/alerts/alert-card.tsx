import { Megaphone } from "lucide-react";
import { AlertSeverityBadge, DemoBadge } from "@/components/shared/status-badges";
import { timeAgo } from "@/lib/utilities/format";
import { cn } from "@/lib/utils";
import type { Alert } from "@/types/domain";

const BORDER: Record<Alert["severity"], string> = {
  danger: "border-l-danger bg-danger-soft/60",
  high: "border-l-high bg-high-soft/60",
  watch: "border-l-watch bg-watch-soft/60",
  info: "border-l-info bg-card",
};

export function AlertCard({ alert, compact = false }: { alert: Alert; compact?: boolean }) {
  return (
    <article
      className={cn("rounded-xl border border-l-4 p-4", BORDER[alert.severity])}
      aria-label={`${alert.severity} alert: ${alert.title}`}
    >
      <div className="flex items-center justify-between gap-2">
        <AlertSeverityBadge severity={alert.severity} />
        <span className="text-xs text-muted-foreground">{timeAgo(alert.created_at)}</span>
      </div>
      <h3 className="mt-2 font-semibold leading-snug">{alert.title}</h3>
      <p className={cn("mt-1 text-sm text-foreground/80", compact && "line-clamp-2")}>{alert.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Megaphone className="size-3.5" aria-hidden />
          Source: <span className="font-medium text-foreground">{alert.source}</span>
        </span>
        {alert.river_basin && <span>{alert.river_basin} basin</span>}
        {alert.source_type === "simulated" && <DemoBadge label="SIMULATED" />}
      </div>
    </article>
  );
}
