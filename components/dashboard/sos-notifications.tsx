"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bell, BellRing, Siren } from "lucide-react";
import { DesktopAlertsToggle } from "@/components/shared/desktop-alerts-toggle";
import { PriorityBadge } from "@/components/shared/status-badges";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SITUATION_LABEL } from "@/lib/risk-engine/sos-priority";
import { timeAgo } from "@/lib/utilities/format";
import { cn } from "@/lib/utils";
import { useOpsData } from "./ops-data";

/** Re-render every 30 s so "x min ago" stays fresh. */
function useTick(ms = 30_000) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

/**
 * Prefix the tab title with the count so a background tab still shows it.
 * Next.js rewrites the title on navigation/hydration, so re-apply on change.
 */
function useTitleCount(count: number) {
  const pathname = usePathname();
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(/^\(\d+\) /, "");
      const wanted = count > 0 ? `(${count}) ${base}` : base;
      if (document.title !== wanted) document.title = wanted;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [count, pathname]);
}

/**
 * Notification centre for the operations header: every SOS no operator has
 * opened yet (status "received"). Items stay until someone opens the
 * incident, which acknowledges it — unlike the pop-up toast, nothing is missed
 * because a screen was not being watched.
 */
export function SosNotifications() {
  const { sos, updates, unreadUpdates, markUpdatesRead } = useOpsData();
  const [open, setOpen] = useState(false);
  useTick();

  const unopened = useMemo(
    () =>
      sos
        .filter((s) => s.status === "received")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [sos],
  );
  const count = unopened.length;
  const badge = count + unreadUpdates;
  useTitleCount(badge);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Citizen updates count as read once the list has been seen.
        if (!next) markUpdatesRead();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-white hover:bg-white/10"
          aria-label={
            badge > 0
              ? `${count} new SOS, ${unreadUpdates} citizen ${unreadUpdates === 1 ? "update" : "updates"} — open notifications`
              : "Notifications — nothing new"
          }
        >
          {badge > 0 ? <BellRing className="size-5" aria-hidden /> : <Bell className="size-5" aria-hidden />}
          {badge > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold leading-5 text-white ring-2 ring-navy"
              aria-hidden
            >
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(24rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <span className="text-xs text-muted-foreground">
            {count > 0 ? `${count} new SOS · not yet opened` : "All caught up"}
          </span>
        </div>

        {count === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
            <Siren className="size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">No new SOS</p>
            <p className="text-xs text-muted-foreground">New complaints from citizens appear here instantly.</p>
          </div>
        ) : (
          <ul className="max-h-[60vh] divide-y overflow-y-auto">
            {unopened.map((s) => {
              const level = s.effective_priority ?? s.priority_level;
              const flags = [
                s.injured && "injured",
                s.children_count > 0 && `${s.children_count} ${s.children_count === 1 ? "child" : "children"}`,
                s.elderly_count > 0 && `${s.elderly_count} elderly`,
              ].filter(Boolean);
              return (
                <li key={s.id}>
                  <Link
                    href={`/dashboard/incidents/${s.id}`}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 transition hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-bold">{s.reference_code}</span>
                        {level && <PriorityBadge level={level} overridden={Boolean(s.operator_priority_override)} />}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(s.created_at)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.people_count} {s.people_count === 1 ? "person" : "people"}
                      {flags.length > 0 && ` · ${flags.join(", ")}`} · {s.location_name ?? "GPS location"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm">
                      <span className="font-medium">{SITUATION_LABEL[s.situation] ?? "SOS"}</span>
                      {s.description ? ` — ${s.description}` : ""}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {updates.length > 0 && (
          <div className="border-t">
            <p className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase">Updates from citizens</p>
            <ul className="max-h-[35vh] divide-y overflow-y-auto">
              {updates.map((u) => {
                const content = (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            u.tone === "danger" ? "bg-danger" : u.tone === "safe" ? "bg-safe" : "bg-primary",
                          )}
                          aria-hidden
                        />
                        {u.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(u.at)}</span>
                    </div>
                    <p className="mt-0.5 pl-4 text-xs text-muted-foreground">{u.body}</p>
                  </>
                );
                return (
                  <li key={u.id + u.at}>
                    {u.href ? (
                      <Link href={u.href} onClick={() => setOpen(false)} className="block px-4 py-2.5 hover:bg-accent">
                        {content}
                      </Link>
                    ) : (
                      <div className="px-4 py-2.5">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="border-t px-4 py-2.5">
          <DesktopAlertsToggle
            enableLabel="Enable desktop alerts for new SOS"
            onLabel="Desktop alerts on — new SOS alert you even when this tab is in the background."
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
