import Link from "next/link";
import {
  ArrowRight,
  Gauge,
  LifeBuoy,
  MapPinned,
  Radio,
  ShieldAlert,
  Siren,
  Truck,
  Users,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { DEMO_MODE } from "@/lib/supabase/env";

const pillars = [
  {
    title: "Know the Risk",
    icon: Gauge,
    body: "Live alerts and a transparent, rule-based flood-risk score that shows exactly why an area is rated DANGER.",
    tone: "text-high-ink bg-high-soft",
  },
  {
    title: "Find Safety",
    icon: MapPinned,
    body: "Nearest shelter with space, and an evacuation route that re-routes around flooded roads and blocked bridges.",
    tone: "text-safe-ink bg-safe-soft",
  },
  {
    title: "Get Help",
    icon: Siren,
    body: "One-tap SOS without an account, prioritised for operators and dispatched to rescue teams with live status.",
    tone: "text-danger-ink bg-danger-soft",
  },
];

const flow = [
  { icon: Radio, label: "Warnings & community reports" },
  { icon: ShieldAlert, label: "Risk scoring & SOS triage" },
  { icon: Users, label: "Operations centre" },
  { icon: Truck, label: "Rescue dispatch" },
  { icon: LifeBuoy, label: "Shelter & safety" },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo inverted subtitle="Flood emergency response" />
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/auth/login"
              className="rounded-lg px-3 py-2 font-medium text-slate-200 hover:bg-white/10 hover:text-white"
            >
              Sign in
            </Link>
          </nav>
        </div>

        <section className="mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:pt-16 lg:pb-24">
          <div>
            <p className="label-caps text-sky-300">Built for Nepal&apos;s monsoon</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Know the Risk.
              <br />
              Find Safety.
              <br />
              <span className="text-sky-300">Get Help.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-slate-300 sm:text-lg">
              Flood warnings alone do not coordinate evacuation and rescue. JalSuraksha turns
              warnings, citizen reports and emergency requests into coordinated evacuation,
              shelter and rescue workflows.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="xl" variant="destructive" className="shadow-lg shadow-red-950/40">
                <Link href="/citizen/sos">
                  <Siren className="size-6" />
                  EMERGENCY SOS
                </Link>
              </Button>
              <Button
                asChild
                size="xl"
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/citizen">
                  Open citizen app
                  <ArrowRight className="size-5" />
                </Link>
              </Button>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              SOS works without an account. In a life-threatening emergency also call 100 (Police) or 102 (Ambulance).
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <p className="label-caps text-slate-400">Workspaces</p>
            <ul className="mt-3 grid gap-2">
              {[
                { href: "/citizen", title: "Citizen app", desc: "Mobile: alerts, map, safe route, SOS, reports" },
                { href: "/dashboard", title: "Emergency Operations Centre", desc: "Desktop: live incidents, triage, dispatch" },
                { href: "/rescue", title: "Rescue team console", desc: "Tablet/phone: missions and status updates" },
                ...(DEMO_MODE
                  ? [{ href: "/dashboard/demo", title: "Presentation mode", desc: "Scripted 14-step hackathon demo" }]
                  : []),
              ].map((w) => (
                <li key={w.href}>
                  <Link
                    href={w.href}
                    className="group flex items-center justify-between rounded-xl border border-white/10 bg-navy/60 px-4 py-3 transition hover:border-sky-400/40 hover:bg-navy"
                  >
                    <span>
                      <span className="block font-semibold text-white">{w.title}</span>
                      <span className="block text-xs text-slate-400">{w.desc}</span>
                    </span>
                    <ArrowRight className="size-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-sky-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {pillars.map((p) => (
            <div key={p.title} className="rounded-2xl border bg-card p-6 shadow-xs">
              <span className={`inline-flex size-11 items-center justify-center rounded-xl ${p.tone}`}>
                <p.icon className="size-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-semibold">{p.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>

        <section className="mt-14">
          <h2 className="text-center text-sm font-semibold text-muted-foreground">
            From warning to rescue, in one shared live picture
          </h2>
          <ol className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
            {flow.map((step, i) => (
              <li key={step.label} className="flex items-center gap-2">
                <span className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 font-medium shadow-xs">
                  <step.icon className="size-4 text-sky-700" aria-hidden />
                  {step.label}
                </span>
                {i < flow.length - 1 && <ArrowRight className="size-4 text-muted-foreground" aria-hidden />}
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14 rounded-2xl border border-dashed bg-muted/50 p-6 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Prototype notice</p>
          <p className="mt-1">
            JalSuraksha is a hackathon prototype. Alerts, river levels, shelters, hazards and incidents
            shown are <strong>simulated demo data</strong> for the Narayani basin (Chitwan). Risk scores are
            transparent rule-based decision support, not flood forecasts. A real deployment requires
            validated DHM/government data and official emergency-response partnerships.
          </p>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        JalSuraksha Nepal · Hackathon prototype · Map data © OpenStreetMap contributors
      </footer>
    </div>
  );
}
