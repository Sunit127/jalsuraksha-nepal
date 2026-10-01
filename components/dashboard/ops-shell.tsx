"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  Bell,
  Building2,
  Database,
  LayoutDashboard,
  LogOut,
  Menu,
  Presentation,
  Radio,
  ShieldAlert,
  Truck,
  Users,
} from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { LogoMark } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { useOpsData } from "./ops-data";
import { SosNotifications } from "./sos-notifications";
import { SimulationBanner } from "@/components/shared/simulation-banner";
import type { AppRole } from "@/types/domain";

type NavItem = { href: string; label: string; icon: typeof Activity; adminOnly?: boolean; demoOnly?: boolean };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Operations", icon: LayoutDashboard },
  { href: "/dashboard/shelters", label: "Shelters", icon: Building2 },
  { href: "/dashboard/hazards", label: "Hazard reports", icon: ShieldAlert },
  { href: "/dashboard/teams", label: "Rescue teams", icon: Truck },
  { href: "/rescue", label: "Rescue consoles", icon: Radio },
  { href: "/dashboard/alerts", label: "Alerts", icon: Bell },
  { href: "/dashboard/data", label: "Data sources", icon: Database },
  { href: "/dashboard/users", label: "Users & roles", icon: Users, adminOnly: true },
  { href: "/dashboard/demo", label: "Presentation mode", icon: Presentation, demoOnly: true },
];

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  if (!now) return <span className="hidden w-[120px] md:inline-block" aria-hidden />;
  return (
    <span className="tabular hidden text-sm text-slate-300 md:inline" aria-label="Local time">
      {now.toLocaleTimeString("en-GB", { timeZone: "Asia/Kathmandu" })} NPT
    </span>
  );
}

function NavLinks({ role, demoMode, onNavigate }: { role: AppRole; demoMode: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Operations" className="grid gap-1">
      {NAV.filter((n) => (!n.adminOnly || role === "admin") && (!n.demoOnly || demoMode)).map((n) => {
        const active = n.href === "/dashboard" ? pathname === "/dashboard" || pathname.startsWith("/dashboard/incidents") : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white",
              active && "bg-white/10 text-white",
            )}
          >
            <n.icon className="size-4" aria-hidden />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function OpsShell({
  children,
  role,
  name,
  demoMode,
}: {
  children: React.ReactNode;
  role: AppRole;
  name: string;
  demoMode: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-navy px-3 py-4 lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2 px-2">
          <LogoMark />
          <span className="leading-tight">
            <span className="block text-sm font-bold text-white">JalSuraksha</span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
              Operations Centre
            </span>
          </span>
        </Link>
        <div className="mt-6 flex-1">
          <NavLinks role={role} demoMode={demoMode} />
        </div>
        <div className="rounded-xl bg-white/5 p-3">
          <p className="truncate text-sm font-medium text-white">{name}</p>
          <p className="text-xs text-slate-400">{ROLE_LABEL[role]}</p>
          <form action={signOut} className="mt-2">
            <button
              type="submit"
              className="flex cursor-pointer items-center gap-2 text-xs text-slate-300 hover:text-white"
            >
              <LogOut className="size-3.5" aria-hidden /> Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/10 bg-navy px-4 text-white">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="text-white hover:bg-white/10 hover:text-white lg:hidden" aria-label="Open navigation">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-navy px-3 py-4 text-white">
              <SheetTitle className="px-2 text-white">JalSuraksha</SheetTitle>
              <NavLinks role={role} demoMode={demoMode} onNavigate={() => setOpen(false)} />
              <form action={signOut} className="mt-auto px-3">
                <button type="submit" className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                  <LogOut className="size-4" aria-hidden /> Sign out
                </button>
              </form>
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              JalSuraksha <span className="font-normal text-slate-400">·</span>{" "}
              <span className="font-normal text-slate-200">Emergency Operations Centre</span>
            </p>
          </div>
          <ConnectionPill />
          <SosNotifications />
          <Clock />
        </header>
        <SnapshotWarning />
        <ModeBanner />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

/** Honest realtime status: only says LIVE when the channels are joined. */
function ConnectionPill() {
  const { realtime } = useOpsData();
  const live = realtime === "live";
  return (
    <span
      role="status"
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        live ? "bg-safe/15 text-emerald-300" : realtime === "offline" ? "bg-danger/25 text-red-200" : "bg-white/10 text-slate-300",
      )}
      title={live ? "Receiving realtime updates" : "Realtime connection interrupted — data refreshes when it reconnects"}
    >
      <span className={cn("relative flex size-2", live ? "text-emerald-400" : "text-slate-400")}>
        <span className={cn("relative size-2 rounded-full", live ? "js-pulse bg-emerald-400" : realtime === "offline" ? "bg-red-400" : "bg-slate-400")} />
      </span>
      {live ? "Live" : realtime === "offline" ? "Reconnecting" : "Connecting"}
    </span>
  );
}

function ModeBanner() {
  const { dataMode } = useOpsData();
  return dataMode === "simulation" ? <SimulationBanner staff /> : null;
}

function SnapshotWarning() {
  const { snapshotOk } = useOpsData();
  const router = useRouter();
  if (snapshotOk) return null;
  return (
    <div role="alert" className="flex items-center gap-2 border-b border-high/40 bg-high-soft px-4 py-2 text-sm text-high-ink">
      <AlertTriangle className="size-4 shrink-0" aria-hidden />
      Some operational data could not be loaded. The view may be incomplete.
      <button type="button" onClick={() => router.refresh()} className="ml-auto flex cursor-pointer items-center gap-1 font-semibold underline">
        <RefreshCcw className="size-3.5" aria-hidden /> Retry
      </button>
    </div>
  );
}
