import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Eye,
  FlaskConical,
  Info,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RiskCategory } from "@/lib/risk-engine/flood-risk";
import type {
  AlertSeverity,
  AssignmentStatus,
  HazardSeverity,
  PriorityLevel,
  SafetyStatus,
  SosStatus,
  TeamStatus,
} from "@/types/domain";
import { ASSIGNMENT_STATUS_LABEL, SOS_STATUS_LABEL } from "@/lib/utilities/status";

type Tone = "safe" | "watch" | "high" | "danger" | "info" | "secondary" | "solidDanger";

const RISK: Record<RiskCategory, { tone: Tone; label: string; Icon: typeof Info }> = {
  safe: { tone: "safe", label: "SAFE", Icon: ShieldCheck },
  watch: { tone: "watch", label: "WATCH", Icon: Eye },
  high: { tone: "high", label: "HIGH", Icon: AlertTriangle },
  danger: { tone: "danger", label: "DANGER", Icon: AlertOctagon },
};

export function RiskBadge({ category, className }: { category: RiskCategory; className?: string }) {
  const r = RISK[category];
  return (
    <Badge variant={r.tone} className={className}>
      <r.Icon aria-hidden />
      {r.label}
    </Badge>
  );
}

const ALERT: Record<AlertSeverity, { tone: Tone; label: string; Icon: typeof Info }> = {
  info: { tone: "info", label: "INFO", Icon: Info },
  watch: { tone: "watch", label: "WATCH", Icon: Eye },
  high: { tone: "high", label: "HIGH", Icon: AlertTriangle },
  danger: { tone: "danger", label: "DANGER", Icon: AlertOctagon },
};

export function AlertSeverityBadge({
  severity,
  className,
}: {
  severity: AlertSeverity;
  className?: string;
}) {
  const a = ALERT[severity];
  return (
    <Badge variant={a.tone} className={className}>
      <a.Icon aria-hidden />
      {a.label}
    </Badge>
  );
}

const PRIORITY: Record<PriorityLevel, { tone: Tone; label: string }> = {
  critical: { tone: "solidDanger", label: "CRITICAL" },
  high: { tone: "high", label: "HIGH" },
  moderate: { tone: "watch", label: "MODERATE" },
  low: { tone: "info", label: "LOW" },
};

export function PriorityBadge({
  level,
  overridden,
  className,
}: {
  level: PriorityLevel;
  overridden?: boolean;
  className?: string;
}) {
  const p = PRIORITY[level];
  return (
    <Badge
      variant={p.tone}
      className={className}
      title={overridden ? "Priority set by operator" : "Automated recommendation"}
    >
      {level === "critical" ? <AlertOctagon aria-hidden /> : <CircleDot aria-hidden />}
      {p.label}
      {overridden && <span className="font-medium normal-case">· op</span>}
    </Badge>
  );
}

export const PRIORITY_DOT: Record<PriorityLevel, string> = {
  critical: "bg-danger",
  high: "bg-high",
  moderate: "bg-watch",
  low: "bg-info",
};

const SOS_STATUS_TONE: Record<SosStatus, Tone> = {
  received: "danger",
  acknowledged: "high",
  assigned: "watch",
  accepted: "watch",
  en_route: "info",
  arrived: "info",
  in_progress: "info",
  resolved: "safe",
  cancelled: "secondary",
};

export function SosStatusBadge({ status, className }: { status: SosStatus; className?: string }) {
  return (
    <Badge variant={SOS_STATUS_TONE[status]} className={className}>
      {status === "resolved" ? <CheckCircle2 aria-hidden /> : <CircleDot aria-hidden />}
      {SOS_STATUS_LABEL[status]}
    </Badge>
  );
}

export function AssignmentStatusBadge({
  status,
  className,
}: {
  status: AssignmentStatus;
  className?: string;
}) {
  const tone: Tone =
    status === "completed" ? "safe" : status === "cancelled" ? "secondary" : status === "assigned" ? "watch" : "info";
  return (
    <Badge variant={tone} className={className}>
      <CircleDot aria-hidden />
      {ASSIGNMENT_STATUS_LABEL[status]}
    </Badge>
  );
}

const TEAM: Record<TeamStatus, { tone: Tone; label: string }> = {
  available: { tone: "safe", label: "AVAILABLE" },
  assigned: { tone: "watch", label: "ASSIGNED" },
  busy: { tone: "high", label: "ON MISSION" },
  offline: { tone: "secondary", label: "OFFLINE" },
};

export function TeamStatusBadge({ status, className }: { status: TeamStatus; className?: string }) {
  return (
    <Badge variant={TEAM[status].tone} className={className}>
      <CircleDot aria-hidden />
      {TEAM[status].label}
    </Badge>
  );
}

const HAZARD_SEV: Record<HazardSeverity, { tone: Tone; label: string }> = {
  low: { tone: "info", label: "LOW" },
  medium: { tone: "watch", label: "MEDIUM" },
  high: { tone: "high", label: "HIGH" },
  critical: { tone: "solidDanger", label: "CRITICAL" },
};

export function HazardSeverityBadge({
  severity,
  className,
}: {
  severity: HazardSeverity;
  className?: string;
}) {
  return (
    <Badge variant={HAZARD_SEV[severity].tone} className={className}>
      <AlertTriangle aria-hidden />
      {HAZARD_SEV[severity].label}
    </Badge>
  );
}

const SAFETY: Record<SafetyStatus, { tone: Tone; label: string }> = {
  unknown: { tone: "secondary", label: "NOT SET" },
  safe: { tone: "safe", label: "SAFE" },
  evacuated: { tone: "info", label: "EVACUATED" },
  need_help: { tone: "solidDanger", label: "NEED HELP" },
};

export function SafetyStatusBadge({ status, className }: { status: SafetyStatus; className?: string }) {
  return (
    <Badge variant={SAFETY[status].tone} className={className}>
      <CircleDot aria-hidden />
      {SAFETY[status].label}
    </Badge>
  );
}

export function DemoBadge({ className, label = "DEMO DATA" }: { className?: string; label?: string }) {
  return (
    <Badge variant="demo" className={className} title="Simulated data for the hackathon demo">
      <FlaskConical aria-hidden />
      {label}
    </Badge>
  );
}
