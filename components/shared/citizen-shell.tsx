"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { House, Map, CircleUserRound, Siren, TriangleAlert, WifiOff, LogIn } from "lucide-react";
import { AlertAlarm } from "@/components/alerts/alert-alarm";
import { Logo } from "@/components/shared/logo";
import { useCitizenData } from "@/components/shared/citizen-data";
import { SimulationBanner } from "@/components/shared/simulation-banner";
import { timeAgo } from "@/lib/utilities/format";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/citizen", label: "Home", icon: House },
  { href: "/citizen/map", label: "Map", icon: Map },
  { href: "/citizen/sos", label: "SOS", icon: Siren, sos: true },
  { href: "/citizen/report", label: "Report", icon: TriangleAlert },
  { href: "/citizen/profile", label: "Profile", icon: CircleUserRound },
];

/** Re-render every 30 s so "x minutes ago" labels stay fresh. */
function useTick(ms = 30_000) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

function OfflineBanner() {
  const { online, fromCache, lastSync } = useCitizenData();
  useTick();
  if (online && !fromCache) return null;
  return (
    <div role="status" className="flex items-center gap-2 bg-slate-900 px-4 py-2 text-xs text-white">
      <WifiOff className="size-4 shrink-0 text-amber-300" aria-hidden />
      <span className="font-semibold tracking-wide">OFFLINE MODE</span>
      <span className="text-slate-300">
        · Last synchronized {lastSync ? timeAgo(lastSync) : "unknown"}
      </span>
    </div>
  );
}

export function CitizenShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, online, realtime, dataMode } = useCitizenData();
  const signedIn = session.userId && !session.isAnonymous;
  const fullBleed = pathname === "/citizen/map" || pathname === "/citizen/route";

  return (
    <div className="min-h-dvh bg-slate-200/70">
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col bg-background shadow-xl shadow-slate-300/50">
        <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-2 px-4">
            <Link href="/citizen" aria-label="JalSuraksha home">
              <Logo />
            </Link>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                  online && realtime === "live" ? "bg-safe-soft text-safe-ink" : "bg-muted text-muted-foreground",
                )}
                title={online ? "Receiving live updates" : "No connection"}
              >
                <span className={cn("size-1.5 rounded-full", online && realtime === "live" ? "bg-safe" : "bg-muted-foreground")} />
                {online ? (realtime === "live" ? "Live" : "Connecting") : "Offline"}
              </span>
              {signedIn ? (
                <Link
                  href="/citizen/profile"
                  className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                  aria-label="My profile"
                >
                  {(session.name ?? "U").slice(0, 1).toUpperCase()}
                </Link>
              ) : (
                <Link
                  href={`/auth/login?next=${encodeURIComponent(pathname)}`}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-primary hover:bg-accent"
                >
                  <LogIn className="size-4" aria-hidden /> Sign in
                </Link>
              )}
            </div>
          </div>
          <OfflineBanner />
          {dataMode === "simulation" && <SimulationBanner />}
        </header>

        <main className={cn("flex-1", fullBleed ? "" : "px-4 pt-4 pb-28")}>{children}</main>

        <AlertAlarm />

        <nav
          aria-label="Main"
          className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t bg-card/95 backdrop-blur"
        >
          <ul className="grid h-16 grid-cols-5 items-end">
            {NAV.map((item) => {
              const active =
                item.href === "/citizen" ? pathname === "/citizen" : pathname.startsWith(item.href);
              if (item.sos) {
                return (
                  <li key={item.href} className="flex justify-center">
                    <Link
                      href={item.href}
                      aria-label="Emergency SOS"
                      aria-current={active ? "page" : undefined}
                      className="-mt-6 mb-1.5 flex size-16 flex-col items-center justify-center rounded-full border-4 border-card bg-danger text-white shadow-lg shadow-red-900/30 transition active:scale-95"
                    >
                      <item.icon className="size-6" aria-hidden />
                      <span className="text-[10px] font-bold tracking-wider">SOS</span>
                    </Link>
                  </li>
                );
              }
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
                      active && "text-primary",
                    )}
                  >
                    <item.icon className={cn("size-5", active && "stroke-[2.4]")} aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
