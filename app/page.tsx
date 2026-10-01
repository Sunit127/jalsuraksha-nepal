import Image from "next/image";
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
import monsoonResponseImage from "@/public/images/jalsuraksha-monsoon-response.png";

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

const workspaces = [
  { href: "/citizen", title: "Citizen app", desc: "Mobile: alerts, map, safe route, SOS, reports", short: "Alerts, map, safe route and SOS" },
  { href: "/dashboard", title: "Emergency Operations Centre", desc: "Desktop: live incidents, triage, dispatch", short: "Live incidents, triage and dispatch" },
  { href: "/rescue", title: "Rescue team console", desc: "Tablet/phone: missions and status updates", short: "Missions and field status updates" },
  ...(DEMO_MODE
    ? [{ href: "/dashboard/demo", title: "Presentation mode", desc: "Scripted 14-step hackathon demo", short: "Scripted 14-step demo" }]
    : []),
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="relative isolate overflow-hidden bg-navy text-navy-foreground">
        <Image
          src={monsoonResponseImage}
          alt=""
          fill
          preload
          sizes="100vw"
          className="-z-20 object-cover object-center"
          aria-hidden="true"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(5,16,39,.97)_0%,rgba(7,25,52,.88)_42%,rgba(7,25,52,.44)_72%,rgba(7,25,52,.62)_100%)]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(3,12,30,.7)_0%,rgba(3,12,30,.08)_45%,rgba(3,12,30,.88)_100%)]" />
        <div className="pointer-events-none absolute -right-32 top-20 -z-10 size-96 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
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

        <section className="relative z-10 mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:pt-20 lg:pb-28">
          <div className="max-w-2xl [text-shadow:0_2px_20px_rgba(2,10,30,.35)]">
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

          <div className="relative">
            <div className="absolute -inset-3 rounded-[2rem] bg-sky-300/15 blur-2xl" />
            <div className="relative rounded-[1.6rem] border border-white/25 bg-white/10 p-2 shadow-2xl shadow-black/40 backdrop-blur-md">
              <div className="rounded-[1.15rem] border border-white/15 bg-slate-950/50 p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="label-caps text-sky-300">Live response picture</span>
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300"><span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_currentColor]" /> Operational</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {workspaces.map((workspace) => (
                    <Link key={workspace.href} href={workspace.href} className="rounded-xl border border-white/10 bg-white/[.07] p-4 hover:border-sky-300/50 hover:bg-white/[.14]">
                      <span className="flex items-center justify-between text-xs font-semibold text-white"><span>{workspace.title}</span><ArrowRight className="size-3.5 text-sky-300" /></span>
                      <span className="mt-2 block text-[11px] leading-4 text-slate-300">{workspace.short}</span>
                    </Link>
                  ))}
                </div>
                <div className="mt-5 rounded-xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-xs text-sky-100">
                  <span className="font-semibold text-white">One coordinated response</span><span className="mx-2 text-sky-300/50">•</span>Turn warnings into safe routes, shelter decisions and faster rescue dispatch.
                </div>
              </div>
            </div>
          </div>
        </section>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <section aria-labelledby="workspaces-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="label-caps text-sky-700">One shared platform</p>
              <h2 id="workspaces-heading" className="mt-1 text-2xl font-bold tracking-tight">
                Choose your workspace
              </h2>
            </div>
            <p className="hidden max-w-md text-right text-sm text-muted-foreground md:block">
              Citizens, operations staff and field teams stay connected to the same live response.
            </p>
          </div>
          <ul className="mt-6 grid gap-3 md:grid-cols-3">
            {workspaces.map((workspace) => (
              <li key={workspace.href}>
                <Link
                  href={workspace.href}
                  className="group flex h-full items-center justify-between rounded-2xl border bg-card p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
                >
                  <span>
                    <span className="block font-semibold">{workspace.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{workspace.desc}</span>
                  </span>
                  <ArrowRight className="ml-3 size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-sky-700" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
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
