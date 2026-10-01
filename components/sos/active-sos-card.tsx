"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Radio, Siren, Truck } from "lucide-react";
import { formatDistance } from "@/lib/utilities/geo";
import { readMySos, syncAccountSos, type MySos } from "@/lib/utilities/my-sos";
import { ASSIGNMENT_STATUS_LABEL, SOS_STATUS_LABEL } from "@/lib/utilities/status";
import { timeAgo } from "@/lib/utilities/format";
import type { AssignmentStatus, SosStatus } from "@/types/domain";

type Summary = {
  ref: string;
  token: string;
  status: SosStatus;
  team: string | null;
  assignment: AssignmentStatus | null;
  teamLocation: { distanceM: number; road: { distanceM: number; minutes: number } | null; updatedAt: string } | null;
};

const REFRESH_MS = 10_000;
/** Re-check the account's own SOS (sent from another device) every minute. */
const ACCOUNT_SYNC_EVERY = 6;

/**
 * On the citizen home: the open SOS sent from this device or by the
 * signed-in account, with where the rescue team is. Tapping opens the full
 * tracker (map, timeline, safe places).
 */
export function ActiveSosCard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const loads = useRef(0);

  const load = useCallback(async () => {
    const dayAgo = Date.now() - 86_400_000;
    const mine = loads.current++ % ACCOUNT_SYNC_EVERY === 0 ? await syncAccountSos() : readMySos();
    const recent = mine.filter((s: MySos) => new Date(s.createdAt).getTime() > dayAgo);
    for (const s of recent) {
      try {
        const res = await fetch(`/api/sos/track?ref=${encodeURIComponent(s.ref)}&token=${encodeURIComponent(s.token)}`, { cache: "no-store" });
        if (!res.ok) continue;
        const d = await res.json();
        if (["resolved", "cancelled"].includes(d.sos.status)) continue;
        const assignment = d.assignment && d.assignment.status !== "cancelled" ? d.assignment : null;
        setSummary({
          ref: s.ref,
          token: s.token,
          status: d.sos.status,
          team: assignment?.rescue_teams?.call_sign ?? null,
          assignment: assignment?.status ?? null,
          teamLocation: d.teamLocation,
        });
        return;
      } catch {
        // Offline: keep showing the last summary.
        return;
      }
    }
    setSummary(null);
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  if (!summary) return null;
  const { teamLocation: loc } = summary;
  const onScene = summary.assignment === "arrived" || summary.assignment === "in_progress";

  return (
    <Link
      href={`/citizen/sos/${summary.ref}?t=${summary.token}`}
      className="flex items-center gap-3 rounded-2xl border-2 border-danger bg-danger-soft p-4 text-danger-ink shadow-sm transition hover:bg-danger-soft/70"
      data-testid="active-sos-card"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-danger text-white">
        {summary.team ? <Truck className="size-6" aria-hidden /> : <Siren className="size-6" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-wide">Your SOS {summary.ref}</span>
        <span className="block text-base font-bold leading-snug">
          {!summary.team
            ? `${SOS_STATUS_LABEL[summary.status]} — a rescue team will be assigned`
            : onScene
              ? `Team ${summary.team} has arrived`
              : loc
                ? `Team ${summary.team} is ${formatDistance(loc.road?.distanceM ?? loc.distanceM)} away${loc.road ? ` · ~${loc.road.minutes} min` : ""}`
                : `Team ${summary.team} · ${ASSIGNMENT_STATUS_LABEL[summary.assignment!]}`}
        </span>
        <span className="flex items-center gap-1 text-xs">
          {loc && !onScene ? (
            <>
              <Radio className="size-3" aria-hidden /> Live position · {timeAgo(loc.updatedAt)} · tap to see the map and safe places
            </>
          ) : (
            "Tap to see the team, your status and safe places nearby"
          )}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0" aria-hidden />
    </Link>
  );
}
